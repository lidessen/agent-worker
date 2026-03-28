/** @jsxImportSource semajsx/dom */
import { render } from "semajsx/dom";
import { App } from "./app.tsx";

// Stores auto-connect on import
import "./stores/connection.ts";

render(<App />, document.getElementById("app")!);
