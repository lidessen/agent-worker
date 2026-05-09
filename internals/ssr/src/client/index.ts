/**
 * Client-side utilities for SemaJSX islands
 */

export {
  hydrate,
  hydrateIsland,
  hydrateIslands,
  hydrateIslandById,
  hydrateAllIslands,
  hasIslands,
  getIslandIds,
  getIslandInfo,
  markIslandHydrated,
} from "./hydrate";

export type { IslandInfo } from "./hydrate";

export { island, isIslandComponent, isIslandVNode, getIslandMetadata } from "./island";

export {
  resource,
  isStyleVNode,
  isLinkVNode,
  isAssetVNode,
  STYLE_MARKER,
  LINK_MARKER,
  ASSET_MARKER,
  type ResourceTools,
  type StyleProps,
  type LinkProps,
  type AssetProps,
} from "./resource";

export {
  clientResource,
  setManifest,
  getManifest,
  resolveCSS,
  resolveAsset,
  loadStylesheet,
  type ClientManifest,
  type ClientResourceTools,
} from "./client-resource";
