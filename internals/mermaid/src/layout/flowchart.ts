import type {
  FlowchartDiagram,
  FlowchartLayout,
  FlowEdge,
  Subgraph,
  PositionedNode,
  PositionedEdge,
  PositionedSubgraph,
  LayoutOptions,
  Size,
} from "../types";
import { measureNode, measureLabel } from "./measure";

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeSpacing: 60,
  rankSpacing: 80,
  nodeWidth: 150,
  nodeHeight: 50,
  nodePadding: 16,
  diagramPadding: 20,
  edgeRouting: "bezier",
};

export function flowchartLayout(
  diagram: FlowchartDiagram,
  options?: Partial<LayoutOptions>,
): FlowchartLayout {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodes, edges, subgraphs, direction } = diagram;

  if (nodes.length === 0) {
    return { width: 0, height: 0, viewBox: "0 0 0 0", nodes: [], edges: [], subgraphs: [] };
  }

  // Phase 1: Measure node sizes
  const nodeSizes = new Map<string, Size>();
  for (const node of nodes) {
    nodeSizes.set(node.id, measureNode(node.label, opts));
  }

  // Separate self-loops from normal edges — they bypass cycle detection and layout
  const selfLoops: FlowEdge[] = [];
  const nonSelfEdges: FlowEdge[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target) {
      selfLoops.push(edge);
    } else {
      nonSelfEdges.push(edge);
    }
  }

  // Phase 2: Cycle removal via DFS — mark back edges, then reverse them
  const backEdgeSet = new Set<FlowEdge>();
  const adj = new Map<string, string[]>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const node of nodes) adj.set(node.id, []);
  for (const edge of nonSelfEdges) {
    adj.get(edge.source)?.push(edge.target);
  }

  function dfs(node: string): void {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (inStack.has(neighbor)) {
        const edge = nonSelfEdges.find((e) => e.source === node && e.target === neighbor);
        if (edge) backEdgeSet.add(edge);
      } else if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }
    inStack.delete(node);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  // Every non-self edge is either kept or reversed — no edges are lost
  // origToSafe maps each user-facing edge → its safe (DAG) counterpart for dummy lookup
  const origToSafe = new Map<FlowEdge, FlowEdge>();
  const safeEdges: FlowEdge[] = nonSelfEdges.map((edge) => {
    const safe = backEdgeSet.has(edge)
      ? { ...edge, source: edge.target, target: edge.source }
      : edge;
    origToSafe.set(edge, safe);
    return safe;
  });

  // Phase 3: Layer assignment (longest path from sources via topological BFS)
  const layers = new Map<string, number>();
  const safeAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    safeAdj.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of safeEdges) {
    safeAdj.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
      layers.set(node.id, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    for (const neighbor of safeAdj.get(current) ?? []) {
      const existingLayer = layers.get(neighbor) ?? -1;
      layers.set(neighbor, Math.max(existingLayer, currentLayer + 1));
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 1) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  for (const node of nodes) {
    if (!layers.has(node.id)) layers.set(node.id, 0);
  }

  // Phase 3.5: Insert dummy nodes for long edges (spanning >1 layer)
  // This is the standard Sugiyama technique: every edge in the internal
  // representation spans exactly one layer, enabling crossing minimization
  // and coordinate assignment to produce smooth, non-overlapping paths.
  const DUMMY_DIM = 8; // nominal dimension so packing doesn't collapse dummies to zero
  const dummySet = new Set<string>();
  const dummySize: Size = { width: DUMMY_DIM, height: DUMMY_DIM };
  // Map from original edge → ordered list of dummy node IDs along its path
  const edgeDummies = new Map<FlowEdge, string[]>();

  // Work on a mutable copy so we can splice in dummy edges
  let workEdges: FlowEdge[] = [...safeEdges];
  {
    const newEdges: FlowEdge[] = [];
    for (const edge of workEdges) {
      const srcLayer = layers.get(edge.source) ?? 0;
      const tgtLayer = layers.get(edge.target) ?? 0;
      const span = tgtLayer - srcLayer;
      if (span <= 1) {
        newEdges.push(edge);
        continue;
      }
      // Insert (span - 1) dummy nodes between source and target
      const dummies: string[] = [];
      let prev = edge.source;
      for (let l = srcLayer + 1; l < tgtLayer; l++) {
        const dummyId = `__dummy_${edge.source}_${edge.target}_${l}`;
        dummies.push(dummyId);
        dummySet.add(dummyId);
        layers.set(dummyId, l);
        nodeSizes.set(dummyId, dummySize);
        // Create a transparent edge from prev → dummy
        newEdges.push({
          source: prev,
          target: dummyId,
          lineStyle: edge.lineStyle,
          sourceMarker: "none",
          targetMarker: "none",
        });
        prev = dummyId;
      }
      // Final edge from last dummy → target
      newEdges.push({
        source: prev,
        target: edge.target,
        lineStyle: edge.lineStyle,
        sourceMarker: "none",
        targetMarker: "none",
      });
      edgeDummies.set(edge, dummies);
    }
    workEdges = newEdges;
  }

  // Phase 4: Group nodes by layer (including dummy nodes)
  const maxLayer = Math.max(...Array.from(layers.values()), 0);
  const layerGroups: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0;
    layerGroups[layer]!.push(node.id);
  }
  for (const dummyId of dummySet) {
    const layer = layers.get(dummyId) ?? 0;
    layerGroups[layer]!.push(dummyId);
  }

  // Phase 5: Subgraph-aware barycenter ordering — 4-pass bidirectional
  const nodeSubgraph = new Map<string, string>();
  for (const sg of subgraphs) {
    mapNodesToSubgraph(sg, nodeSubgraph);
  }

  // Build parent/child adjacency from work edges (includes dummy edges)
  const allNodeIds = [...nodes.map((n) => n.id), ...dummySet];
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const id of allNodeIds) {
    parents.set(id, []);
    children.set(id, []);
  }
  for (const edge of workEdges) {
    children.get(edge.source)?.push(edge.target);
    parents.get(edge.target)?.push(edge.source);
  }

  for (let pass = 0; pass < 4; pass++) {
    if (pass % 2 === 0) {
      // Top-down sweep
      for (let l = 1; l <= maxLayer; l++) {
        orderLayerByBarycenter(layerGroups[l]!, layerGroups[l - 1]!, parents, nodeSubgraph);
      }
    } else {
      // Bottom-up sweep
      for (let l = maxLayer - 1; l >= 0; l--) {
        orderLayerByBarycenter(layerGroups[l]!, layerGroups[l + 1]!, children, nodeSubgraph);
      }
    }
  }

  // Phase 5 post-pass: Transpose optimization — swap adjacent pairs to reduce crossings
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let l = 0; l < maxLayer; l++) {
      const layer = layerGroups[l]!;
      const nextLayer = layerGroups[l + 1]!;
      for (let i = 0; i < layer.length - 1; i++) {
        const crossBefore = countCrossings(layer, nextLayer, children);
        // Try swapping
        const tmp = layer[i]!;
        layer[i] = layer[i + 1]!;
        layer[i + 1] = tmp;
        const crossAfter = countCrossings(layer, nextLayer, children);
        if (crossAfter < crossBefore) {
          improved = true; // keep swap
        } else {
          // Revert swap
          layer[i + 1] = layer[i]!;
          layer[i] = tmp;
        }
      }
    }
    if (!improved) break;
  }

  // Phase 5.5: Variable rank positions with subgraph-aware spacing
  const isVertical = direction === "TB" || direction === "TD" || direction === "BT";
  const sgLayerRanges = computeSubgraphLayerRanges(subgraphs, layers);
  const allSubgraphs = flattenSubgraphs(subgraphs);
  const rankNodeDim = isVertical ? opts.nodeHeight : opts.nodeWidth;
  const sgTitleHeight = 20;
  const rankPos: number[] = [0];
  for (let l = 0; l < maxLayer; l++) {
    let overhead = 0;
    for (const sg of allSubgraphs) {
      const range = sgLayerRanges.get(sg.id);
      if (!range || range.minLayer > range.maxLayer) continue;
      if (range.maxLayer === l) overhead += opts.nodePadding;
      if (range.minLayer === l + 1) overhead += opts.nodePadding + sgTitleHeight;
    }
    const extra = overhead > 0 ? Math.max(0, overhead - opts.rankSpacing + opts.nodePadding) : 0;
    rankPos.push(rankPos[l]! + rankNodeDim + opts.rankSpacing + extra);
  }

  // Phase 6: Coordinate assignment with cross-layer median alignment

  // Primary-axis dimension of a node.
  const dim = (id: string): number => {
    if (dummySet.has(id)) return DUMMY_DIM;
    const size = nodeSizes.get(id)!;
    return isVertical ? size.width : size.height;
  };

  // Spacing between adjacent nodes — extra gap at subgraph boundaries
  const gap = (a: string, b: string): number => {
    const sgA = nodeSubgraph.get(a);
    const sgB = nodeSubgraph.get(b);
    if (sgA !== sgB) {
      return opts.nodeSpacing + opts.nodePadding * 2;
    }
    return opts.nodeSpacing;
  };

  // Brandes-Köpf style coordinate assignment:
  // Compute 4 independent alignments (up-left, up-right, down-left, down-right),
  // each starting from a packed layout and aligning toward one direction.
  // Take the median of the 4 results for each node — produces balanced, compact layouts.
  const bkResults: Map<string, number>[] = [];

  for (let dir = 0; dir < 4; dir++) {
    const isDown = dir < 2; // 0,1 = top-down; 2,3 = bottom-up
    const isLeft = dir % 2 === 0; // 0,2 = left-aligned; 1,3 = right-aligned
    const alignment = isDown ? parents : children;

    const p = new Map<string, number>();
    // Pack layers centered as baseline
    for (let l = 0; l <= maxLayer; l++) {
      packLayerCentered(layerGroups[l]!, p, dim, gap);
    }

    // Align passes
    const sweeps = 4;
    for (let s = 0; s < sweeps; s++) {
      if (isDown) {
        for (let l = 1; l <= maxLayer; l++) {
          alignLayerBK(layerGroups[l]!, alignment, p, dim, gap, isLeft);
        }
      } else {
        for (let l = maxLayer - 1; l >= 0; l--) {
          alignLayerBK(layerGroups[l]!, alignment, p, dim, gap, isLeft);
        }
      }
    }
    bkResults.push(p);
  }

  // Merge: take median of 4 alignments for each node
  const pos = new Map<string, number>();
  for (const id of allNodeIds) {
    const vals = bkResults.map((r) => r.get(id) ?? 0).sort((a, b) => a - b);
    // Median of 4 values = average of the middle 2
    pos.set(id, (vals[1]! + vals[2]!) / 2);
  }

  // Linear segments: align dummy node chains to a single x-position.
  // Each chain of dummy nodes from the same long edge should form a
  // straight vertical (or horizontal) line, preventing zigzag artifacts.
  for (const [, dummies] of edgeDummies) {
    if (dummies.length === 0) continue;
    // Compute average x-position of the chain
    let sum = 0;
    for (const id of dummies) {
      sum += pos.get(id) ?? 0;
    }
    const avg = sum / dummies.length;
    for (const id of dummies) {
      pos.set(id, avg);
    }
  }

  // Convert 1D primary-axis positions to 2D coordinates (real + dummy nodes)
  const nodeLayer = new Map<string, number>();
  for (let l = 0; l <= maxLayer; l++) {
    for (const id of layerGroups[l]!) nodeLayer.set(id, l);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of allNodeIds) {
    const p = pos.get(id) ?? 0;
    const l = nodeLayer.get(id) ?? 0;
    if (isVertical) {
      positions.set(id, { x: p, y: rankPos[l]! });
    } else {
      positions.set(id, { x: rankPos[l]!, y: p });
    }
  }

  // Center and apply padding — exclude dummy nodes from bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [id, p] of positions) {
    if (dummySet.has(id)) continue;
    const size = nodeSizes.get(id)!;
    minX = Math.min(minX, p.x - size.width / 2);
    minY = Math.min(minY, p.y - size.height / 2);
    maxX = Math.max(maxX, p.x + size.width / 2);
    maxY = Math.max(maxY, p.y + size.height / 2);
  }

  const offsetX = opts.diagramPadding - minX;
  const offsetY = opts.diagramPadding - minY;
  for (const [, p] of positions) {
    p.x += offsetX;
    p.y += offsetY;
  }

  if (direction === "BT") {
    const totalHeight = maxY - minY;
    for (const [, p] of positions) {
      p.y = totalHeight - (p.y - opts.diagramPadding) + opts.diagramPadding;
    }
  }
  if (direction === "RL") {
    const totalWidth = maxX - minX;
    for (const [, p] of positions) {
      p.x = totalWidth - (p.x - opts.diagramPadding) + opts.diagramPadding;
    }
  }

  // Ensure subgraph bounds stay within positive coordinates
  if (subgraphs.length > 0) {
    let extraShiftX = 0;
    let extraShiftY = 0;
    for (const sg of subgraphs) {
      const sgMin = precomputeSgMin(sg, positions, nodeSizes, opts);
      extraShiftX = Math.max(extraShiftX, opts.diagramPadding - sgMin.minX);
      extraShiftY = Math.max(extraShiftY, opts.diagramPadding - sgMin.minY);
    }
    if (extraShiftX > 0 || extraShiftY > 0) {
      for (const [, p] of positions) {
        p.x += extraShiftX;
        p.y += extraShiftY;
      }
    }
  }

  // Build positioned nodes
  const positionedNodes: PositionedNode[] = nodes.map((node) => {
    const p = positions.get(node.id)!;
    const size = nodeSizes.get(node.id)!;
    return { node, x: p.x, y: p.y, width: size.width, height: size.height };
  });

  // Phase 7: Edge routing — uses dummy waypoints for long edges
  const positionedEdges: PositionedEdge[] = edges.map((edge) => {
    // Self-loop: render as a curved loop on the right side of the node
    if (edge.source === edge.target) {
      const p = positions.get(edge.source);
      const size = nodeSizes.get(edge.source);
      if (!p || !size) return { edge, path: "M 0 0" };

      const loopSize = 30;
      const rx = size.width / 2;
      const ry = size.height / 2;

      let path: string;
      let labelMid: { x: number; y: number };
      if (isVertical) {
        // Loop exits right side, curves up-right, comes back
        const sx = p.x + rx;
        const sy = p.y - ry * 0.3;
        const tx = p.x + rx;
        const ty = p.y + ry * 0.3;
        const cx = p.x + rx + loopSize;
        path = `M ${sx} ${sy} C ${cx} ${sy - loopSize} ${cx} ${ty + loopSize} ${tx} ${ty}`;
        labelMid = { x: cx + 4, y: p.y };
      } else {
        // Loop exits bottom, curves down-right, comes back
        const sx = p.x - rx * 0.3;
        const sy = p.y + ry;
        const tx = p.x + rx * 0.3;
        const ty = p.y + ry;
        const cy = p.y + ry + loopSize;
        path = `M ${sx} ${sy} C ${sx - loopSize} ${cy} ${tx + loopSize} ${cy} ${tx} ${ty}`;
        labelMid = { x: p.x, y: cy + 4 };
      }

      let labelPosition;
      let labelSize;
      if (edge.label) {
        labelPosition = labelMid;
        labelSize = measureLabel(edge.label, opts);
      }
      return { edge, path, labelPosition, labelSize };
    }

    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    if (!sourcePos || !targetPos) {
      return { edge, path: "M 0 0" };
    }

    const sourceSize = nodeSizes.get(edge.source)!;
    const targetSize = nodeSizes.get(edge.target)!;

    // Check if this edge was split by dummy nodes (long edge)
    const safeEdge = origToSafe.get(edge);
    const dummies = safeEdge ? edgeDummies.get(safeEdge) : undefined;

    if (dummies && dummies.length > 0) {
      // Route through dummy waypoints for smoother long-edge rendering
      const waypoints = dummies.map((id) => positions.get(id)!);
      const result = buildLongEdgePath(
        sourcePos,
        targetPos,
        sourceSize,
        targetSize,
        waypoints,
        isVertical,
        opts,
      );
      let labelPosition;
      let labelSize;
      if (edge.label) {
        labelPosition = result.labelMid;
        labelSize = measureLabel(edge.label, opts);
      }
      return { edge, path: result.path, labelPosition, labelSize };
    }

    const result = buildEdgePath(sourcePos, targetPos, sourceSize, targetSize, isVertical, opts);

    let labelPosition;
    let labelSize;
    if (edge.label) {
      labelPosition = result.labelMid;
      labelSize = measureLabel(edge.label, opts);
    }

    return { edge, path: result.path, labelPosition, labelSize };
  });

  // Phase 8: Subgraph bounding boxes (recursive — children first, parents expand)
  const positionedSubgraphs: PositionedSubgraph[] = [];

  function layoutSubgraph(sg: Subgraph): PositionedSubgraph {
    const childPositioned: PositionedSubgraph[] = [];
    for (const child of sg.subgraphs ?? []) {
      childPositioned.push(layoutSubgraph(child));
    }

    let sgMinX = Infinity,
      sgMinY = Infinity,
      sgMaxX = -Infinity,
      sgMaxY = -Infinity;

    for (const nodeId of sg.nodes) {
      const p = positions.get(nodeId);
      const size = nodeSizes.get(nodeId);
      if (p && size) {
        sgMinX = Math.min(sgMinX, p.x - size.width / 2);
        sgMinY = Math.min(sgMinY, p.y - size.height / 2);
        sgMaxX = Math.max(sgMaxX, p.x + size.width / 2);
        sgMaxY = Math.max(sgMaxY, p.y + size.height / 2);
      }
    }

    for (const child of childPositioned) {
      sgMinX = Math.min(sgMinX, child.x);
      sgMinY = Math.min(sgMinY, child.y);
      sgMaxX = Math.max(sgMaxX, child.x + child.width);
      sgMaxY = Math.max(sgMaxY, child.y + child.height);
    }

    const padding = opts.nodePadding;
    const positioned: PositionedSubgraph = {
      subgraph: sg,
      x: sgMinX - padding,
      y: sgMinY - padding - 20,
      width: sgMaxX - sgMinX + padding * 2,
      height: sgMaxY - sgMinY + padding * 2 + 20,
    };

    positionedSubgraphs.push(positioned);
    return positioned;
  }

  for (const sg of subgraphs) {
    layoutSubgraph(sg);
  }

  // Final dimensions — compute from actual element extents
  let extMaxX = -Infinity;
  let extMaxY = -Infinity;
  for (const pn of positionedNodes) {
    extMaxX = Math.max(extMaxX, pn.x + pn.width / 2);
    extMaxY = Math.max(extMaxY, pn.y + pn.height / 2);
  }
  for (const psg of positionedSubgraphs) {
    extMaxX = Math.max(extMaxX, psg.x + psg.width);
    extMaxY = Math.max(extMaxY, psg.y + psg.height);
  }

  const diagramWidth = extMaxX + opts.diagramPadding;
  const diagramHeight = extMaxY + opts.diagramPadding;

  return {
    width: diagramWidth,
    height: diagramHeight,
    viewBox: `0 0 ${diagramWidth} ${diagramHeight}`,
    nodes: positionedNodes,
    edges: positionedEdges,
    subgraphs: positionedSubgraphs,
  };
}

// ── Helpers ────────────────────────────────────────────────

/** Map each node to its most immediate (deepest) containing subgraph. */
function mapNodesToSubgraph(sg: Subgraph, out: Map<string, string>): void {
  for (const nodeId of sg.nodes) {
    out.set(nodeId, sg.id);
  }
  for (const child of sg.subgraphs ?? []) {
    mapNodesToSubgraph(child, out);
  }
}

/**
 * Order a layer using barycenter heuristic with subgraph clustering.
 * `neighbors` maps each node to its connected nodes in the reference layer.
 * Nodes in the same subgraph are kept adjacent.
 */
function orderLayerByBarycenter(
  layer: string[],
  refLayer: string[],
  neighborMap: Map<string, string[]>,
  nodeSubgraph: Map<string, string>,
): void {
  const barycenters = new Map<string, number>();

  // Pre-build index map for O(1) lookup instead of O(n) includes/indexOf
  const refIndex = new Map<string, number>();
  for (let i = 0; i < refLayer.length; i++) {
    refIndex.set(refLayer[i]!, i);
  }

  for (const nodeId of layer) {
    const nbrs = neighborMap.get(nodeId) ?? [];
    let sum = 0;
    let count = 0;
    for (const n of nbrs) {
      const idx = refIndex.get(n);
      if (idx !== undefined) {
        sum += idx;
        count++;
      }
    }
    if (count > 0) {
      barycenters.set(nodeId, sum / count);
    }
  }

  // Compute group barycenters for subgraph clustering
  const groupBary = new Map<string, number>();
  for (const nodeId of layer) {
    const sgId = nodeSubgraph.get(nodeId) ?? "";
    if (!groupBary.has(sgId)) {
      const members = layer.filter((n) => (nodeSubgraph.get(n) ?? "") === sgId);
      const connected = members.filter((n) => barycenters.has(n));
      if (connected.length > 0) {
        const avg = connected.reduce((s, n) => s + barycenters.get(n)!, 0) / connected.length;
        groupBary.set(sgId, avg);
      }
    }
  }

  // Stable sort: group barycenter → individual barycenter → original order
  const original = [...layer];
  layer.sort((a, b) => {
    const sgA = nodeSubgraph.get(a) ?? "";
    const sgB = nodeSubgraph.get(b) ?? "";
    if (sgA !== sgB) {
      const ga = groupBary.get(sgA);
      const gb = groupBary.get(sgB);
      if (ga !== undefined && gb !== undefined && ga !== gb) return ga - gb;
      if (ga !== undefined && gb === undefined) return -1;
      if (ga === undefined && gb !== undefined) return 1;
    }
    const ba = barycenters.get(a);
    const bb = barycenters.get(b);
    if (ba !== undefined && bb !== undefined && ba !== bb) return ba - bb;
    if (ba !== undefined && bb === undefined) return -1;
    if (ba === undefined && bb !== undefined) return 1;
    return original.indexOf(a) - original.indexOf(b);
  });
}

/**
 * Count edge crossings between two adjacent layers.
 * Two edges (u1→v1) and (u2→v2) cross iff u1 < u2 and v1 > v2 (or vice versa).
 */
function countCrossings(
  upperLayer: string[],
  lowerLayer: string[],
  children: Map<string, string[]>,
): number {
  // Build position index for lower layer
  const lowerIdx = new Map<string, number>();
  for (let i = 0; i < lowerLayer.length; i++) {
    lowerIdx.set(lowerLayer[i]!, i);
  }

  // Collect all edges as (upperPos, lowerPos) pairs
  const edgePairs: [number, number][] = [];
  for (let ui = 0; ui < upperLayer.length; ui++) {
    for (const child of children.get(upperLayer[ui]!) ?? []) {
      const li = lowerIdx.get(child);
      if (li !== undefined) {
        edgePairs.push([ui, li]);
      }
    }
  }

  // Count inversions (naive O(e²) — sufficient for typical diagram sizes)
  let crossings = 0;
  for (let i = 0; i < edgePairs.length; i++) {
    for (let j = i + 1; j < edgePairs.length; j++) {
      const [u1, v1] = edgePairs[i]!;
      const [u2, v2] = edgePairs[j]!;
      if ((u1 < u2 && v1 > v2) || (u1 > u2 && v1 < v2)) {
        crossings++;
      }
    }
  }
  return crossings;
}

/** Pack a layer centered at x=0 with minimum spacing. */
function packLayerCentered(
  layer: string[],
  pos: Map<string, number>,
  dim: (id: string) => number,
  gap: (a: string, b: string) => number,
): void {
  if (layer.length === 0) return;

  let totalWidth = dim(layer[0]!);
  for (let i = 1; i < layer.length; i++) {
    totalWidth += gap(layer[i - 1]!, layer[i]!) + dim(layer[i]!);
  }

  let offset = -totalWidth / 2;
  for (let i = 0; i < layer.length; i++) {
    const id = layer[i]!;
    const d = dim(id);
    if (i > 0) offset += gap(layer[i - 1]!, id);
    pos.set(id, offset + d / 2);
    offset += d;
  }
}

/**
 * Brandes-Köpf style single-direction alignment.
 * `isLeft`: when true, prefer the left (lower-index) median neighbor;
 * when false, prefer the right (higher-index) median neighbor.
 * This produces 4 distinct alignments that are then merged via median.
 */
function alignLayerBK(
  layer: string[],
  neighborMap: Map<string, string[]>,
  pos: Map<string, number>,
  dim: (id: string) => number,
  gap: (a: string, b: string) => number,
  isLeft: boolean,
): void {
  if (layer.length === 0) return;

  const ideal = new Map<string, number>();
  for (const id of layer) {
    const nbrs = neighborMap.get(id) ?? [];
    if (nbrs.length > 0) {
      const xs = nbrs.map((n) => pos.get(n)!).sort((a, b) => a - b);
      const mid = Math.floor(xs.length / 2);
      if (xs.length % 2 === 1) {
        ideal.set(id, xs[mid]!);
      } else {
        // Left alignment picks the lower median, right picks the upper
        ideal.set(id, isLeft ? xs[mid - 1]! : xs[mid]!);
      }
    }
  }

  if (ideal.size === 0) return;

  // Process in left-to-right or right-to-left order
  const indices = layer.map((_, i) => i);
  if (!isLeft) indices.reverse();

  for (const i of indices) {
    const id = layer[i]!;
    const target = ideal.get(id);
    if (target === undefined) continue;

    const halfDim = dim(id) / 2;

    let minPos = -Infinity;
    if (i > 0) {
      const leftId = layer[i - 1]!;
      minPos = pos.get(leftId)! + dim(leftId) / 2 + gap(leftId, id) + halfDim;
    }

    let maxPos = Infinity;
    if (i < layer.length - 1) {
      const rightId = layer[i + 1]!;
      maxPos = pos.get(rightId)! - dim(rightId) / 2 - gap(id, rightId) - halfDim;
    }

    pos.set(id, Math.max(minPos, Math.min(maxPos, target)));
  }
}

// ── Edge routing ──────────────────────────────────────────

/** Default curvature factor (matches xyflow) */
const DEFAULT_CURVATURE = 0.25;

/**
 * Calculate control-point offset along the primary axis.
 * When distance >= 0 (normal flow), the offset is half the distance.
 * When distance < 0 (backward edge), use a wider curve via sqrt scaling.
 */
function controlOffset(distance: number, curvature: number): number {
  if (distance >= 0) {
    return 0.5 * distance;
  }
  return curvature * 25 * Math.sqrt(-distance);
}

/**
 * Compute the label position on a cubic bezier at t=0.5.
 * Uses the exact bezier midpoint formula instead of a simple linear midpoint.
 */
export function bezierMidpoint(
  sx: number,
  sy: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  return {
    x: sx * 0.125 + cx1 * 0.375 + cx2 * 0.375 + tx * 0.125,
    y: sy * 0.125 + cy1 * 0.375 + cy2 * 0.375 + ty * 0.125,
  };
}

function buildEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  sourceSize: Size,
  targetSize: Size,
  isVertical: boolean,
  opts: LayoutOptions,
): { path: string; labelMid: { x: number; y: number } } {
  let sx: number, sy: number, tx: number, ty: number;

  if (isVertical) {
    sx = source.x;
    sy = source.y + sourceSize.height / 2;
    tx = target.x;
    ty = target.y - targetSize.height / 2;

    if (source.y > target.y) {
      sy = source.y - sourceSize.height / 2;
      ty = target.y + targetSize.height / 2;
    }
  } else {
    sx = source.x + sourceSize.width / 2;
    sy = source.y;
    tx = target.x - targetSize.width / 2;
    ty = target.y;

    if (source.x > target.x) {
      sx = source.x - sourceSize.width / 2;
      tx = target.x + targetSize.width / 2;
    }
  }

  if (opts.edgeRouting === "bezier") {
    if (isVertical) {
      const dist = ty - sy;
      const offset = controlOffset(dist, DEFAULT_CURVATURE);
      const cy1 = sy + offset;
      const cy2 = ty - offset;
      const mid = bezierMidpoint(sx, sy, sx, cy1, tx, cy2, tx, ty);
      return {
        path: `M ${sx} ${sy} C ${sx} ${cy1} ${tx} ${cy2} ${tx} ${ty}`,
        labelMid: mid,
      };
    } else {
      const dist = tx - sx;
      const offset = controlOffset(dist, DEFAULT_CURVATURE);
      const cx1 = sx + offset;
      const cx2 = tx - offset;
      const mid = bezierMidpoint(sx, sy, cx1, sy, cx2, ty, tx, ty);
      return {
        path: `M ${sx} ${sy} C ${cx1} ${sy} ${cx2} ${ty} ${tx} ${ty}`,
        labelMid: mid,
      };
    }
  }

  if (opts.edgeRouting === "orthogonal") {
    // Manhattan-style routing: horizontal and vertical segments only
    if (isVertical) {
      const midY = (sy + ty) / 2;
      return {
        path: `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`,
        labelMid: { x: (sx + tx) / 2, y: midY },
      };
    } else {
      const midX = (sx + tx) / 2;
      return {
        path: `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`,
        labelMid: { x: midX, y: (sy + ty) / 2 },
      };
    }
  }

  // Polyline fallback
  return {
    path: `M ${sx} ${sy} L ${tx} ${ty}`,
    labelMid: { x: (sx + tx) / 2, y: (sy + ty) / 2 },
  };
}

/**
 * Build a smooth path through dummy waypoints for edges spanning multiple layers.
 * Uses cubic Bezier spline fitting through the waypoints for bezier mode,
 * or polyline/orthogonal segments through the waypoints for other modes.
 */
function buildLongEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  sourceSize: Size,
  targetSize: Size,
  waypoints: { x: number; y: number }[],
  isVertical: boolean,
  opts: LayoutOptions,
): { path: string; labelMid: { x: number; y: number } } {
  // Compute start/end points at node edges
  let sx: number, sy: number, tx: number, ty: number;
  if (isVertical) {
    sx = source.x;
    sy = source.y + sourceSize.height / 2;
    tx = target.x;
    ty = target.y - targetSize.height / 2;
    if (source.y > target.y) {
      sy = source.y - sourceSize.height / 2;
      ty = target.y + targetSize.height / 2;
    }
  } else {
    sx = source.x + sourceSize.width / 2;
    sy = source.y;
    tx = target.x - targetSize.width / 2;
    ty = target.y;
    if (source.x > target.x) {
      sx = source.x - sourceSize.width / 2;
      tx = target.x + targetSize.width / 2;
    }
  }

  // Full point sequence: source edge → waypoints → target edge
  const points = [{ x: sx, y: sy }, ...waypoints, { x: tx, y: ty }];

  // Label position at the middle waypoint
  const midIdx = Math.floor(points.length / 2);
  const labelMid = points[midIdx]!;

  if (opts.edgeRouting === "bezier" && points.length >= 3) {
    // Catmull-Rom to cubic Bezier conversion for smooth spline through waypoints
    let d = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[Math.min(points.length - 1, i + 2)]!;
      // Catmull-Rom tangents (tension = 0, uniform parameterization)
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }
    return { path: d, labelMid };
  }

  if (opts.edgeRouting === "orthogonal") {
    let d = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      if (isVertical) {
        const midY = (prev.y + curr.y) / 2;
        d += ` L ${prev.x} ${midY} L ${curr.x} ${midY} L ${curr.x} ${curr.y}`;
      } else {
        const midX = (prev.x + curr.x) / 2;
        d += ` L ${midX} ${prev.y} L ${midX} ${curr.y} L ${curr.x} ${curr.y}`;
      }
    }
    return { path: d, labelMid };
  }

  // Polyline fallback — straight lines through all waypoints
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]!.x} ${points[i]!.y}`;
  }
  return { path: d, labelMid };
}

/** Compute the layer range (min, max) for each subgraph including nested children. */
function computeSubgraphLayerRanges(
  subgraphs: Subgraph[],
  layers: Map<string, number>,
): Map<string, { minLayer: number; maxLayer: number }> {
  const ranges = new Map<string, { minLayer: number; maxLayer: number }>();

  function compute(sg: Subgraph): { minLayer: number; maxLayer: number } {
    let minL = Infinity;
    let maxL = -Infinity;
    for (const nodeId of sg.nodes) {
      const l = layers.get(nodeId);
      if (l !== undefined) {
        minL = Math.min(minL, l);
        maxL = Math.max(maxL, l);
      }
    }
    for (const child of sg.subgraphs ?? []) {
      const childRange = compute(child);
      minL = Math.min(minL, childRange.minLayer);
      maxL = Math.max(maxL, childRange.maxLayer);
    }
    const range = { minLayer: minL, maxLayer: maxL };
    ranges.set(sg.id, range);
    return range;
  }

  for (const sg of subgraphs) compute(sg);
  return ranges;
}

/** Flatten a subgraph tree into a flat array of all subgraphs. */
function flattenSubgraphs(subgraphs: Subgraph[]): Subgraph[] {
  const result: Subgraph[] = [];
  function collect(sg: Subgraph): void {
    result.push(sg);
    for (const child of sg.subgraphs ?? []) collect(child);
  }
  for (const sg of subgraphs) collect(sg);
  return result;
}

/** Pre-compute the minimum x/y bounds of a subgraph (including nested children). */
function precomputeSgMin(
  sg: Subgraph,
  positions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, Size>,
  opts: LayoutOptions,
): { minX: number; minY: number } {
  const titleHeight = 20;
  let minX = Infinity;
  let minY = Infinity;
  for (const nodeId of sg.nodes) {
    const p = positions.get(nodeId);
    const size = nodeSizes.get(nodeId);
    if (p && size) {
      minX = Math.min(minX, p.x - size.width / 2);
      minY = Math.min(minY, p.y - size.height / 2);
    }
  }
  for (const child of sg.subgraphs ?? []) {
    const childMin = precomputeSgMin(child, positions, nodeSizes, opts);
    minX = Math.min(minX, childMin.minX);
    minY = Math.min(minY, childMin.minY);
  }
  return {
    minX: minX - opts.nodePadding,
    minY: minY - opts.nodePadding - titleHeight,
  };
}
