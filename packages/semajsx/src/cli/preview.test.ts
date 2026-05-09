import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runPreview } from "./preview";

describe("cli preview", () => {
  let servers: Awaited<ReturnType<typeof runPreview>>[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((s) => s.close()));
    servers = [];
  });

  it("serves index html and virtual entry for a component file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "semajsx-preview-"));
    const file = join(dir, "Hello.tsx");
    writeFileSync(
      file,
      `/** @jsxImportSource semajsx/dom */
export default function Hello() {
  return <h1>hi</h1>;
}
`,
    );

    const server = await runPreview(file, { port: 0, open: false });
    servers.push(server);

    const addr = server.httpServer?.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    expect(port).toBeGreaterThan(0);

    const htmlRes = await fetch(`http://localhost:${port}/`);
    const html = await htmlRes.text();
    expect(htmlRes.headers.get("content-type")).toMatch(/text\/html/);
    expect(html).toContain('<div id="root">');
    expect(html).toContain("/@semajsx-preview-entry.js");
    expect(html).toContain("Hello.tsx"); // title

    const entryRes = await fetch(`http://localhost:${port}/@semajsx-preview-entry.js`);
    const entry = await entryRes.text();
    expect(entry).toContain("import { h }");
    expect(entry).toContain("import { render }");
    // The user file path shows up in the import
    expect(entry).toContain("Hello.tsx");
  });

  it("rejects a non-existent file", async () => {
    await expect(
      runPreview("/definitely/not/a/real/file.tsx", { port: 0, open: false }),
    ).rejects.toThrow(/File not found/);
  });
});
