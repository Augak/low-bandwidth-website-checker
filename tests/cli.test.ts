import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";

function cli(...args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], { cwd: process.cwd() });
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

test("help and invalid CLI inputs", async () => {
  for (const flag of ["-h", "--help"]) {
    const result = await cli(flag);
    assert.equal(result.code, 0); assert.match(result.stdout, /Usage:/); assert.match(result.stdout, /--json/);
  }
  for (const args of [[], ["--wat"], ["--html-threshold-bytes"], ["--image-threshold-bytes", "-1", "http://example.com"], ["--html-threshold-bytes", "1.5", "http://example.com"], ["--html-threshold-bytes", "9007199254740992", "http://example.com"], ["file:///etc/passwd"], ["http://example.com", "http://example.org"]]) {
    const result = await cli(...args);
    assert.equal(result.code, 1, JSON.stringify(args)); assert.notEqual(result.stderr, ""); assert.equal(result.stdout, "");
  }
});

test("CLI emits real JSON, preserves legacy output and applies thresholds and exit codes", async () => {
  const html = '<img src="/image" alt=""><a href="/ok">ok</a>';
  const server = createServer((req, res) => {
    if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(html); }
    if (req.url === "/issues") { res.writeHead(200, { "content-type": "text/html" }); return res.end('<img src="/image"><a href="/missing">missing</a>'); }
    if (req.url === "/image") { res.writeHead(200, { "content-length": "300" }); return res.end(); }
    if (req.url === "/ok") { res.writeHead(200); return res.end(); }
    res.writeHead(404); res.end();
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/`;
    const legacy = await cli(url);
    assert.equal(legacy.code, 0); assert.match(legacy.stdout, /Website:/); assert.match(legacy.stdout, /Images checked: 1\/1/);
    const json = await cli("--json", url, "--fail-on-issues");
    assert.equal(json.code, 0); assert.equal(json.stderr, "");
    const report = JSON.parse(json.stdout);
    assert.equal(report.url, url); assert.equal(report.htmlBytes, Buffer.byteLength(html));
    assert.deepEqual(report.missingAlt, []); assert.equal(report.imageCount, 1); assert.equal(report.images[0].size, 300); assert.equal(report.links[0].status, 200);
    const custom = await cli(url, "--html-threshold-bytes", "1", "--image-threshold-bytes", "299", "--fail-on-issues");
    assert.equal(custom.code, 2); assert.match(custom.stdout, /reduce unnecessary HTML/); assert.match(custom.stdout, /Large image/);
    const boundary = await cli("--fail-on-issues", "--html-threshold-bytes", String(Buffer.byteLength(html)), "--image-threshold-bytes", "300", url);
    assert.equal(boundary.code, 0); assert.doesNotMatch(boundary.stdout, /Large image|reduce unnecessary HTML/);
    const issues = await cli("--json", "--fail-on-issues", `${url}issues`);
    assert.equal(issues.code, 2); assert.equal(JSON.parse(issues.stdout).links[0].status, 404);
    assert.equal((await cli(`${url}issues`)).code, 0);
    const failed = await cli("--json", `${url}missing`);
    assert.equal(failed.code, 1); assert.equal(failed.stdout, ""); assert.match(failed.stderr, /HTTP 404/);
  } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
});
