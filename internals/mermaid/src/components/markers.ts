import type { EdgeMarker, ArrowType } from "../types";

/** SVG marker URL by EdgeMarker type (used by flowchart edges). */
export const MARKER_URL: Record<EdgeMarker, string | undefined> = {
  arrow: "url(#mmd-arrow)",
  dot: "url(#mmd-dot)",
  cross: "url(#mmd-cross)",
  none: undefined,
};

/**
 * Resolve an ArrowType (sequence diagram) to a marker URL.
 * This bridges the sequence-specific enum to the shared marker definitions in defs.tsx.
 */
const SEQUENCE_MARKER: Record<ArrowType, string> = {
  solid: "url(#mmd-arrow)",
  dotted: "url(#mmd-arrow)",
  solidCross: "url(#mmd-cross)",
  dottedCross: "url(#mmd-cross)",
  solidOpen: "url(#mmd-arrow-open)",
  dottedOpen: "url(#mmd-arrow-open)",
};

/** Get marker-end URL for a sequence message arrow type. */
export function sequenceMarker(arrow: ArrowType): string {
  return SEQUENCE_MARKER[arrow];
}

/** Check if an ArrowType renders with a dashed stroke. */
export function isDottedArrow(arrow: ArrowType): boolean {
  return arrow === "dotted" || arrow === "dottedCross" || arrow === "dottedOpen";
}
