import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createWebServer } from "../src/server.js";

test("interface serves and performs real checks; cross-origin requests are rejected", async () => {
  const fixture = createServer((req, res) => { if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end("<img src=/pic><a href=/broken>Link</a>"); } else if (req.url === "/pic") { res.writeHead(200, { "content-length": "300000" }); res.end(); } else { res.writeHead(404); res.end(); } });
  const app = createWebServer();
  fixture.listen(0, "127.0.0.1"); app.listen(0, "127.0.0.1"); await Promise.all([once(fixture, "listening"), once(app, "listening")]);
  try {
    const a = app.address(), f = fixture.address(); assert.ok(a && typeof a !== "string" && f && typeof f !== "string");
    const base = `http://127.0.0.1:${a.port}`;
    const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Make every byte/);
    const blocked = await fetch(`${base}/api/check`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", "x-checker-request": "1" }, body: JSON.stringify({ url: `http://127.0.0.1:${f.port}/` }) }); assert.equal(blocked.status, 403);
    const result = await fetch(`${base}/api/check`, { method: "POST", headers: { "content-type": "application/json", origin: base, "x-checker-request": "1" }, body: JSON.stringify({ url: `http://127.0.0.1:${f.port}/` }) });
    assert.equal(result.status, 200); const report = await result.json() as { missingAlt: string[]; images: { size: number }[]; links: { status: number }[] };
    assert.equal(report.missingAlt.length, 1); assert.equal(report.images[0].size, 300000); assert.equal(report.links[0].status, 404);
    const invalid = await fetch(`${base}/api/check`, { method: "POST", headers: { "content-type": "application/json", origin: base, "x-checker-request": "1" }, body: JSON.stringify({ url: "file:///etc/passwd" }) }); assert.equal(invalid.status, 400);
  } finally { app.close(); fixture.close(); }
});
