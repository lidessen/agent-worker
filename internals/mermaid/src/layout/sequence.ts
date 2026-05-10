import type {
  SequenceDiagram,
  SequenceLayout,
  Message,
  Note,
  PositionedParticipant,
  PositionedMessage,
  PositionedLifeline,
  PositionedActivation,
  PositionedBlock,
  PositionedNote,
  LayoutOptions,
} from "../types";
import { estimateTextSize, measureNode, measureLabel } from "./measure";

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeSpacing: 200,
  rankSpacing: 50,
  nodeWidth: 120,
  nodeHeight: 40,
  nodePadding: 16,
  diagramPadding: 20,
  edgeRouting: "bezier",
};

export function sequenceLayout(
  diagram: SequenceDiagram,
  options?: Partial<LayoutOptions>,
): SequenceLayout {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { participants, messages, blocks, notes } = diagram;

  if (participants.length === 0) {
    return {
      width: 0,
      height: 0,
      viewBox: "0 0 0 0",
      participants: [],
      messages: [],
      lifelines: [],
      activations: [],
      blocks: [],
      notes: [],
    };
  }

  // Phase 1: Measure participants and compute label-aware column spacing
  const participantIndex = new Map<string, number>();
  const participantSizes = new Map<string, { width: number; height: number }>();
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]!;
    participantIndex.set(p.id, i);
    participantSizes.set(p.id, measureNode(p.label, opts));
  }

  // Compute minimum spacing between each pair of adjacent participants
  // based on participant label widths and message label widths between them
  const pairSpacing: number[] = []; // spacing[i] = gap between participant i and i+1
  for (let i = 0; i < participants.length - 1; i++) {
    const left = participants[i]!;
    const right = participants[i + 1]!;
    const leftSize = participantSizes.get(left.id)!;
    const rightSize = participantSizes.get(right.id)!;

    // Minimum distance: half of left + half of right + gap
    let minDist = leftSize.width / 2 + rightSize.width / 2 + opts.nodePadding * 2;

    // Check message labels between this pair for wider required spacing
    for (const msg of messages) {
      const fi = participantIndex.get(msg.from);
      const ti = participantIndex.get(msg.to);
      if (fi === undefined || ti === undefined) continue;

      // Only consider messages that span exactly between these two columns
      // (or pass through them)
      const lo = Math.min(fi, ti);
      const hi = Math.max(fi, ti);
      if (lo <= i && hi >= i + 1 && msg.text) {
        // The label needs to fit between the two participants
        const labelSize = measureLabel(msg.text, opts);
        const spanCols = hi - lo;
        // Distribute label width across the spanned column gaps
        const perGap = (labelSize.width + opts.nodePadding * 2) / spanCols;
        minDist = Math.max(minDist, perGap);
      }
    }

    pairSpacing.push(Math.max(minDist, opts.nodeSpacing));
  }

  // Assign x positions based on computed spacing
  const participantX = new Map<string, number>();
  let currentX =
    opts.diagramPadding + (participantSizes.get(participants[0]!.id)?.width ?? opts.nodeWidth) / 2;
  participantX.set(participants[0]!.id, currentX);
  for (let i = 1; i < participants.length; i++) {
    currentX += pairSpacing[i - 1]!;
    participantX.set(participants[i]!.id, currentX);
  }

  const headerY = opts.diagramPadding + opts.nodeHeight / 2;
  const headerBottom = headerY + opts.nodeHeight / 2 + 20;

  // Phase 2: Unified row assignment — interleave messages and notes in parsing order
  const selfMessageWidth = 40; // horizontal extension for self-messages
  const selfMessageHeight = 30; // vertical height for self-message loop
  const positionedMessages: PositionedMessage[] = [];
  const positionedNotes: PositionedNote[] = [];
  let currentY = headerBottom;

  // noteMessageCounts[i] = number of messages parsed before note[i]
  const noteMessageCounts = diagram._noteMessageCounts ?? notes.map(() => messages.length);
  let nextNoteIdx = 0;

  for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
    // Insert any notes that appear before this message in the parsing order
    while (
      nextNoteIdx < notes.length &&
      (noteMessageCounts[nextNoteIdx] ?? messages.length) <= msgIdx
    ) {
      currentY = positionNote(
        notes[nextNoteIdx]!,
        nextNoteIdx,
        currentY,
        positionedNotes,
        participantX,
        opts,
      );
      nextNoteIdx++;
    }

    const msg = messages[msgIdx]!;
    const fromX = participantX.get(msg.from) ?? 0;
    const toX = participantX.get(msg.to) ?? 0;
    const isSelf = msg.from === msg.to;

    positionedMessages.push({
      message: msg,
      fromX,
      toX: isSelf ? fromX + selfMessageWidth : toX,
      y: currentY,
    });

    // Self-messages need extra vertical space for the loop
    currentY += isSelf ? selfMessageHeight + opts.rankSpacing * 0.5 : opts.rankSpacing;
  }

  // Any remaining notes after the last message
  while (nextNoteIdx < notes.length) {
    currentY = positionNote(
      notes[nextNoteIdx]!,
      nextNoteIdx,
      currentY,
      positionedNotes,
      participantX,
      opts,
    );
    nextNoteIdx++;
  }

  // Phase 3: Activation tracking
  const activationStarts = new Map<string, number>();
  const positionedActivations: PositionedActivation[] = [];

  for (const pmsg of positionedMessages) {
    const msg = pmsg.message;
    if (msg.activate) {
      activationStarts.set(msg.to, pmsg.y);
    }
    if (msg.deactivate) {
      const startY = activationStarts.get(msg.from);
      if (startY !== undefined) {
        const x = participantX.get(msg.from) ?? 0;
        const participant = participants.find((p) => p.id === msg.from);
        if (participant) {
          positionedActivations.push({
            participant,
            x: x - 7,
            y: startY,
            width: 14,
            height: pmsg.y - startY,
          });
        }
        activationStarts.delete(msg.from);
      }
    }
  }

  // Calculate diagram height (consider both messages and notes)
  const lastMsg = positionedMessages[positionedMessages.length - 1];
  const lastNote = positionedNotes[positionedNotes.length - 1];
  const lastMessageY = lastMsg ? lastMsg.y : headerBottom;
  const lastNoteY = lastNote ? lastNote.y + lastNote.height : headerBottom;
  const diagramBottom = Math.max(lastMessageY, lastNoteY) + opts.rankSpacing;

  // Phase 4: Lifelines
  const positionedLifelines: PositionedLifeline[] = participants.map((p) => {
    const x = participantX.get(p.id) ?? 0;
    return { participant: p, x, y1: headerY + opts.nodeHeight / 2, y2: diagramBottom };
  });

  // Phase 5: Blocks
  // Build a message identity map for O(1) index lookup (reference equality)
  const msgIndexMap = new Map<Message, number>();
  for (let i = 0; i < messages.length; i++) {
    msgIndexMap.set(messages[i]!, i);
  }

  const positionedBlocks: PositionedBlock[] = blocks.map((block) => {
    const blockMsgs = block.messages;
    const allMsgs = [...blockMsgs, ...(block.sections?.flatMap((s) => s.messages) ?? [])];

    let minX = Infinity;
    let maxX = -Infinity;

    for (const msg of allMsgs) {
      const fromX = participantX.get(msg.from) ?? 0;
      const toX = participantX.get(msg.to) ?? 0;
      minX = Math.min(minX, fromX, toX);
      maxX = Math.max(maxX, fromX, toX);
    }

    // Find y range from positioned messages using reference identity
    const msgIndices = allMsgs.map((m) => msgIndexMap.get(m) ?? -1).filter((i) => i >= 0);

    const firstBlockMsg =
      msgIndices.length > 0 ? positionedMessages[Math.min(...msgIndices)] : undefined;
    const lastBlockMsg =
      msgIndices.length > 0 ? positionedMessages[Math.max(...msgIndices)] : undefined;
    const startY = firstBlockMsg ? firstBlockMsg.y - 20 : headerBottom;
    const endY = lastBlockMsg ? lastBlockMsg.y + 20 : headerBottom + opts.rankSpacing;

    // Compute section divider y-positions for alt/par blocks
    let sectionDividers: { y: number; label: string }[] | undefined;
    if (block.sections && block.sections.length > 0) {
      sectionDividers = [];
      for (const section of block.sections) {
        // Find the first message in this section to determine the divider y
        const sectionMsgIndices = section.messages
          .map((m) => msgIndexMap.get(m) ?? -1)
          .filter((i) => i >= 0);
        if (sectionMsgIndices.length > 0) {
          const firstSectionMsg = positionedMessages[Math.min(...sectionMsgIndices)];
          if (firstSectionMsg) {
            sectionDividers.push({ y: firstSectionMsg.y - 15, label: section.label });
          }
        }
      }
    }

    const padding = opts.nodePadding;
    return {
      block,
      x: minX - padding - opts.nodeWidth / 2,
      y: startY,
      width: maxX - minX + opts.nodeWidth + padding * 2,
      height: endY - startY,
      sectionDividers,
    };
  });

  // Positioned participants (use measured sizes)
  const positionedParticipants: PositionedParticipant[] = participants.map((p) => {
    const x = participantX.get(p.id) ?? 0;
    const size = participantSizes.get(p.id)!;
    return { participant: p, x, y: headerY, width: size.width, height: opts.nodeHeight };
  });

  // Final dimensions — compute from actual participant positions
  const firstX = participantX.get(participants[0]!.id)!;
  const lastX = participantX.get(participants[participants.length - 1]!.id)!;
  const firstHalf = (participantSizes.get(participants[0]!.id)?.width ?? opts.nodeWidth) / 2;
  const lastHalf =
    (participantSizes.get(participants[participants.length - 1]!.id)?.width ?? opts.nodeWidth) / 2;
  const diagramWidth =
    lastX + lastHalf + opts.diagramPadding - (firstX - firstHalf - opts.diagramPadding);
  const diagramHeight = diagramBottom + opts.diagramPadding;

  return {
    width: diagramWidth,
    height: diagramHeight,
    viewBox: `0 0 ${diagramWidth} ${diagramHeight}`,
    participants: positionedParticipants,
    messages: positionedMessages,
    lifelines: positionedLifelines,
    activations: positionedActivations,
    blocks: positionedBlocks,
    notes: positionedNotes,
  };
}

/** Position a single note and advance currentY, returning the new currentY */
function positionNote(
  note: Note,
  _index: number,
  currentY: number,
  out: PositionedNote[],
  participantX: Map<string, number>,
  opts: LayoutOptions,
): number {
  const pIds = note.participants;
  const xs = pIds.map((id) => participantX.get(id) ?? 0).filter((x) => x > 0);

  let x: number;
  if (note.position === "left of") {
    x = (xs[0] ?? opts.diagramPadding) - opts.nodeWidth;
  } else if (note.position === "right of") {
    x = (xs[0] ?? opts.diagramPadding) + opts.nodeWidth;
  } else {
    // "over" — centered between participants
    x = xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : opts.diagramPadding;
  }

  const size = estimateTextSize(note.text, 12);
  const noteHeight = Math.max(size.height + opts.nodePadding, 30);

  out.push({
    note,
    x,
    y: currentY,
    width: Math.max(size.width + opts.nodePadding * 2, 80),
    height: noteHeight,
  });

  return currentY + noteHeight + opts.rankSpacing * 0.3;
}
