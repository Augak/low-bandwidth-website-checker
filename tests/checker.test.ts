import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { checkPage, formatReport } from "../src/checker.js";

test("reports missing alt, large images and broken links", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<img src=/large><img src=/small alt=\"\"><a href=/missing>Link</a><a href=/missing#duplicate>Duplicate</a>"); }
    if (req.url === "/large") { res.writeHead(200, { "content-length": "300000" }); return res.end(); }
    if (req.url === "/small") { res.writeHead(200, { "content-length": "5" }); return res.end(); }
    res.writeHead(404); res.end();
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { const addr = server.address(); assert.ok(addr && typeof addr !== "string"); const r = await checkPage(`http://127.0.0.1:${addr.port}/`); assert.equal(r.missingAlt.length, 1); assert.equal(r.imageCount, 2); assert.equal(r.linkCount, 1); assert.equal(r.links[0].status, 404); assert.equal(r.images[0].size, 300000); assert.match(formatReport(r), /Large image/); assert.match(formatReport(r), /HTTP 404/); } finally { server.close(); }
});
test("rejects non-HTTP URLs", async () => { await assert.rejects(checkPage("file:///etc/passwd"), /valid HTTP/); });
