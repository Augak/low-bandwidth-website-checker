import * as cheerio from "cheerio";

export type Resource = { url: string; status?: number; size?: number; error?: string };
export type Report = { url: string; htmlBytes: number; missingAlt: string[]; images: Resource[]; links: Resource[]; imageCount: number; linkCount: number };

function resolveUrl(value: string, base: string): string | undefined {
  try { const u = new URL(value, base); if (!/^(http:|https:)$/.test(u.protocol) || u.username || u.password) return; u.hash = ""; return u.href; } catch { return; }
}
async function request(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "LowBandwidthWebsiteChecker/0.1", ...options.headers } });
}
async function inspect(url: string): Promise<Resource> {
  try {
    let res = await request(url, { method: "HEAD" });
    if (res.status === 405 || res.status === 501) { await res.body?.cancel(); res = await request(url, { headers: { Range: "bytes=0-0" } }); }
    const range = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
    const length = range ?? (res.status === 206 ? undefined : res.headers.get("content-length"));
    const size = length && /^\d+$/.test(length) ? Number(length) : undefined;
    await res.body?.cancel();
    return { url, status: res.status, size };
  } catch (err) { return { url, error: err instanceof Error ? err.message : String(err) }; }
}
async function mapLimited(urls: string[]): Promise<Resource[]> {
  const results: Resource[] = new Array(urls.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => { while (next < urls.length) { const i = next++; results[i] = await inspect(urls[i]); } }));
  return results;
}
// Fetch exposes decompressed bytes. Limit those bytes rather than trusting Content-Length,
// which may be absent, incorrect, or describe a compressed response.
const MAX_HTML_BYTES = 2 * 1024 * 1024;
async function readHtml(res: Response): Promise<string> {
  if (!res.body) throw new Error("Page returned an empty HTML body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) throw new Error(`HTML exceeds the ${MAX_HTML_BYTES}-byte limit`);
      parts.push(decoder.decode(value, { stream: true }));
    }
    if (!bytes) throw new Error("Page returned an empty HTML body");
    parts.push(decoder.decode());
    return parts.join("");
  } catch (err) {
    // Do not leave an unwanted response streaming in the background.
    await reader.cancel().catch(() => {});
    throw err;
  } finally {
    reader.releaseLock();
  }
}

export async function checkPage(input: string): Promise<Report> {
  const url = resolveUrl(input, input); if (!url) throw new Error("Provide a valid HTTP(S) URL without credentials.");
  const res = await request(url);
  if (!res.ok || res.status === 206) {
    await res.body?.cancel().catch(() => {});
    if (res.status === 206) throw new Error("Page returned partial HTML (HTTP 206)");
    throw new Error(`Page returned HTTP ${res.status}`);
  }
  const type = res.headers.get("content-type") ?? "";
  const mediaType = type.split(";", 1)[0].trim().toLowerCase();
  if (type && mediaType !== "text/html" && mediaType !== "application/xhtml+xml") {
    await res.body?.cancel().catch(() => {});
    throw new Error(`Expected HTML, got ${type}`);
  }
  const html = await readHtml(res); const $ = cheerio.load(html);
  const baseAttr = $("base[href]").first().attr("href"); const base = baseAttr ? (resolveUrl(baseAttr, res.url) ?? res.url) : res.url;
  const missingAlt: string[] = []; const imageUrls: string[] = []; const linkUrls: string[] = [];
  $("img").each((i, el) => { const image = $(el); const src = image.attr("src") ?? ""; if (image.attr("alt") === undefined) missingAlt.push(`Image ${i + 1}: ${src || "(no src)"}`); const u = src && resolveUrl(src, base); if (u) imageUrls.push(u); });
  $("a[href]").each((_i, el) => { const href = $(el).attr("href")?.trim() ?? ""; if (!href || href.startsWith("#")) return; const u = resolveUrl(href, base); if (u) linkUrls.push(u); });
  const images = [...new Set(imageUrls)]; const links = [...new Set(linkUrls)];
  const [imageResults, linkResults] = await Promise.all([mapLimited(images.slice(0, 20)), mapLimited(links.slice(0, 25))]);
  return { url: res.url, htmlBytes: Buffer.byteLength(html, "utf8"), missingAlt, images: imageResults, links: linkResults, imageCount: images.length, linkCount: links.length };
}
export function formatReport(r: Report): string {
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
  const lines = [`Website: ${r.url}`, `Decoded HTML: ${kb(r.htmlBytes)} (not total transfer size)`];
  if (r.htmlBytes > 100 * 1024) lines.push("Suggestion: reduce unnecessary HTML.");
  lines.push(`Missing alt: ${r.missingAlt.length}`, ...r.missingAlt.map(x => `  ${x}`));
  if (r.missingAlt.length) lines.push("Add descriptive alt text, or empty alt for decorative images.");
  lines.push(`Images checked: ${r.images.length}/${r.imageCount} (limit 20)`);
  for (const x of r.images) { if (x.error || (x.status && x.status >= 400)) lines.push(`  Could not check ${x.url}: ${x.error ?? `HTTP ${x.status}`}`); else if (x.size === undefined) lines.push(`  Size unknown: ${x.url}`); else if (x.size > 200 * 1024) lines.push(`  Large image: ${x.url} (${kb(x.size)}). Consider resizing or compression.`); }
  lines.push(`Links checked: ${r.links.length}/${r.linkCount} (limit 25)`);
  for (const x of r.links) { if (x.error) lines.push(`  Could not check ${x.url}: ${x.error}`); else if (x.status && x.status >= 400) lines.push(`  ${x.url}: HTTP ${x.status}${x.status === 401 || x.status === 403 ? " (may require access)" : ""}`); }
  lines.push("Static HTML only: JavaScript content, srcset, CSS images and total transfer size are not measured."); return lines.join("\n");
}
