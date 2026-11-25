import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { checkPage } from "./checker.js";

const HTML = new URL("../public/index.html", import.meta.url);
function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosiff" });
  res.end(JSON.stringify(body));
}
export function createWebServer() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host || "";
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return reply(res, 403, { error: "Invalid local host." });
    if (req.method === "GET" && req.url === "/") {
      try { const html = await readFile(HTML); res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src \u0027self\u0027; script-src \u0027self\u0027 \u0027unsafe-inline\u0027; style-src \u0027self\u0027 \u0027unsafe-inline\u0027; connect-src \u0027self\u0027; base-uri \u0027none\u0027; frame-ancestors \u0027none\u0027" }); res.end(html); } catch { reply(res, 500, { error: "Interface file is unavailable." }); }
      return;
    }
    if (req.method !== "POST" || req.url !== "/api/check") return reply(res, 404, { error: "Not found." });
    if (req.headers.origin !== `http://${host}` || req.headers["x-checker-request"] !== "1" || !(req.headers["content-type"] || "").startsWith("application/json")) return reply(res, 403, { error: "Invalid request origin." });
    try {
      let body = "";
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) return reply(res, 413, { error: "Request is too large." }); }
      const data: unknown = JSON.parse(body);
      if (!data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string" || data.url.length > 2048) return reply(res, 400, { error: "Enter a valid website URL." });
      const report = await checkPage(data.url);
      return reply(res, 200, report);
    } catch (error) { return reply(res, 400, { error: error instanceof Error ? error.message : "Unable to check this website." }); }
  });
}
