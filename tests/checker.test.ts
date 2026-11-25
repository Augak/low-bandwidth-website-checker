import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { gzipSync } from "node:zlib";
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

const limit = 2 * 1024 * 1024;
test("bounds streamed and compressed HTML without returning partial findings", async () => {
  const compressed = gzipSync(Buffer.alloc(limit + 1, 32));
  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (req.url === "/compressed") {
      res.writeHead(200, { "content-encoding": "gzip", "content-length": compressed.length });
      return res.end(compressed);
    }
    // Chunked responses have no Content-Length and must still be bounded.
    if (req.url === "/too-large") {
      res.write(Buffer.alloc(limit, 32));
      return res.end("x");
    }
    res.end(Buffer.alloc(limit, 32));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); assert.ok(addr && typeof addr !== "string");
    const base = `http://127.0.0.1:${addr.port}`;
    const exact = await checkPage(`${base}/exact`);
    assert.equal(exact.htmlBytes, limit);
    await assert.rejects(checkPage(`${base}/too-large`), /HTML exceeds the 2097152-byte limit/);
    await assert.rejects(checkPage(`${base}/compressed`), /HTML exceeds the 2097152-byte limit/);
  } finally { server.closeAllConnections(); server.close(); }
});

test("rejects non-HTML, empty, partial and failed responses explicitly", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/bad-type") { res.writeHead(200, { "content-type": "application/nottext/html" }); return res.end("<img>"); }
    if (req.url === "/json") { res.writeHead(200, { "content-type": "application/json" }); return res.end("{}"); }
    if (req.url === "/partial") { res.writeHead(206, { "content-type": "text/html" }); return res.end("<img>"); }
    if (req.url === "/empty") { res.writeHead(204); return res.end(); }
    if (req.url === "/error") { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": "APPLICATION/XHTML+XML; charset=utf-8" }); res.end("<p>ok</p>");
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); assert.ok(addr && typeof addr !== "string");
    const base = `http://127.0.0.1:${addr.port}`;
    for (const path of ["bad-type", "json"]) await assert.rejects(checkPage(`${base}/${path}`), /Expected HTML/);
    await assert.rejects(checkPage(`${base}/partial`), /partial HTML/);
    await assert.rejects(checkPage(`${base}/empty`), /empty HTML body/);
    await assert.rejects(checkPage(`${base}/error`), /HTTP 404/);
    assert.equal((await checkPage(`${base}/valid`)).missingAlt.length, 0);
  } finally { server.closeAllConnections(); server.close(); }
});

test("decodes split UTF-8 and resolves base and duplicate URLs", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      const html = Buffer.from('<base href="/dir/"><img src="café" alt=""><img src="other"><a href="link#one">x</a><a href="link#two">y</a>', "utf8");
      const split = html.indexOf(Buffer.from("é")) + 1;
      res.write(html.subarray(0, split));
      return setTimeout(() => res.end(html.subarray(split)), 10);
    }
    res.writeHead(200, { "content-length": "2" }); res.end();
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const addr = server.address(); assert.ok(addr && typeof addr !== "string");
    const base = `http://127.0.0.1:${addr.port}`;
    const report = await checkPage(`${base}/`);
    assert.deepEqual(report.missingAlt, ["Image 2: other"]);
    assert.equal(report.images[0].url, `${base}/dir/caf%C3%A9`);
    assert.equal(report.linkCount, 1);
    assert.equal(report.links[0].url, `${base}/dir/link`);
  } finally { server.closeAllConnections(); server.close(); }
});
