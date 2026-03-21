/** @jsxImportSource semajsx/dom */

import { DocViewer } from "../components/doc-viewer.tsx";

export function DocViewerPanel(props: { wsKey: string; docName: string }) {
  return <DocViewer wsKey={props.wsKey} docName={props.docName} />;
}
