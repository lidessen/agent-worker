/** @jsxImportSource semajsx/dom */

import { Native } from "semajsx/dom";
import type { VNode } from "semajsx";

interface IconDef {
  viewBox: string;
  paths: string[];
}

interface IconProps {
  icon: IconDef;
  size?: number;
  class?: string;
  style?: string;
}

function createSvg(icon: IconDef, props: { size?: number; class?: string; style?: string }): SVGSVGElement {
  const size = String(props.size ?? 16);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", icon.viewBox);
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (props.class) svg.setAttribute("class", props.class);
  if (props.style) svg.setAttribute("style", props.style);

  for (const d of icon.paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }

  return svg;
}

export function Icon(props: IconProps): VNode {
  return Native({ element: createSvg(props.icon, props) });
}

export const ArrowUp: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["M12 19V5", "m5 10-5-5-5 5"],
};

export const ArrowDown: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["M12 5v14", "m5-5-5 5-5-5"],
};

export const ArrowLeft: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["M19 12H5", "m10-7-7 7 7 7"],
};

export const ChevronDown: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["m6 9 6 6 6-6"],
};

export const ChevronRight: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["m9 18 6-6-6-6"],
};

export const MessageCircle: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
};

export const Wrench: IconDef = {
  viewBox: "0 0 24 24",
  paths: ["M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2 2 0 1 1-2.8-2.8l9.4-9.4a4 4 0 0 0-5-5l2.2-2.2a4 4 0 0 1 .6 5Z"],
};

export const Drama: IconDef = {
  viewBox: "0 0 24 24",
  paths: [
    "M10 11h.01",
    "M14 6h.01",
    "M18 6h.01",
    "M6.5 13.1h.01",
    "M22 5c0 9-9 14-9 14S4 14 4 5c0-1.5 1.5-3 3-3 1.3 0 2.4.8 2.8 2 0 0 1.2-2 3.2-2s3.2 2 3.2 2A3 3 0 0 1 19 2c1.5 0 3 1.5 3 3",
  ],
};
