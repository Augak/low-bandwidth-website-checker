import { checkPage, formatReport, type Report } from "./checker.js";

const DEFAULT_HTML_BYTES = 100 * 1024;
const DEFAULT_IMAGE_BYTES = 200 * 1024;
const HELP = `Usage: npm run check -- [options] <http(s)://url>

Check the static HTML of a page and a limited number of its images and links.

Options:
  -h, --help                     Show this help and exit
  --json                         Output the actual report as JSON
  --html-threshold-bytes <n>     Flag HTML larger than n bytes (default: 102400)
  --image-threshold-bytes <n>    Flag images larger than n bytes (default: 204800)
  --fail-on-issues               Exit 2 if the report contains issues

Issues include missing alt attributes, HTML or measured images above the
threshold, and failed image/link checks (including HTTP 4xx/5xx). Unknown image
sizes are not assumed to be large. Thresholds are non-negative integer bytes.
Exit codes: 0 success, 1 invalid input or check failure, 2 issues with
--fail-on-issues. The checker samples resources and does not measure total
transfer size or JavaScript-rendered content.`;

type Options = { url?: string; json: boolean; failOnIssues: boolean; htmlBytes: number; imageBytes: number; help: boolean };

function parseArgs(args: string[]): Options {
  const result: Options = { json: false, failOnIssues: false, htmlBytes: DEFAULT_HTML_BYTES, imageBytes: DEFAULT_IMAGE_BYTES, help: false };
  let positionalOnly = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!positionalOnly && arg === "--") { positionalOnly = true; continue; }
    if (!positionalOnly && (arg === "--help" || arg === "-h")) { result.help = true; continue; }
    if (!positionalOnly && arg === "--json") { result.json = true; continue; }
    if (!positionalOnly && arg === "--fail-on-issues") { result.failOnIssues = true; continue; }
    if (!positionalOnly && (arg === "--html-threshold-bytes" || arg === "--image-threshold-bytes")) {
      const value = args[++i];
      if (value === undefined || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`${arg} requires a non-negative safe integer in bytes.`);
      }
      if (arg === "--html-threshold-bytes") result.htmlBytes = Number(value);
      else result.imageBytes = Number(value);
      continue;
    }
    if (!positionalOnly && arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (result.url !== undefined) throw new Error("Provide exactly one URL.");
    result.url = arg;
  }
  return result;
}

function hasIssues(report: Report, options: Options): boolean {
  const failed = (resource: Report["images"][number]) => Boolean(resource.error || (resource.status !== undefined && resource.status >= 400));
  return report.htmlBytes > options.htmlBytes || report.missingAlt.length > 0 ||
    report.images.some(image => failed(image) || (image.size !== undefined && image.size > options.imageBytes)) ||
    report.links.some(failed);
}

// The checker's formatter uses fixed defaults; render custom thresholds here without
// changing the measured report or claiming that unchecked resources were analysed.
function formatWithThresholds(r: Report, options: Options): string {
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
  const lines = [`Website: ${r.url}`, `Decoded HTML: ${kb(r.htmlBytes)} (not total transfer size)`];
  if (r.htmlBytes > options.htmlBytes) lines.push("Suggestion: reduce unnecessary HTML.");
  lines.push(`Missing alt: ${r.missingAlt.length}`, ...r.missingAlt.map(x => `  ${x}`));
  if (r.missingAlt.length) lines.push("Add descriptive alt text, or empty alt for decorative images.");
  lines.push(`Images checked: ${r.images.length}/${r.imageCount} (limit 20)`);
  for (const x of r.images) {
    if (x.error || (x.status !== undefined && x.status >= 400)) lines.push(`  Could not check ${x.url}: ${x.error ?? `HTTP ${x.status}`}`);
    else if (x.size === undefined) lines.push(`  Size unknown: ${x.url}`);
    else if (x.size > options.imageBytes) lines.push(`  Large image: ${x.url} (${kb(x.size)}). Consider resizing or compression.`);
  }
  lines.push(`Links checked: ${r.links.length}/${r.linkCount} (limit 25)`);
  for (const x of r.links) {
    if (x.error) lines.push(`  Could not check ${x.url}: ${x.error}`);
    else if (x.status !== undefined && x.status >= 400) lines.push(`  ${x.url}: HTTP ${x.status}${x.status === 401 || x.status === 403 ? " (may require access)" : ""}`);
  }
  lines.push("Static HTML only: JavaScript content, srcset, CSS images and total transfer size are not measured.");
  return lines.join("\n");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) console.log(HELP);
  else if (!options.url) { console.error(`Error: Provide a URL.\n${HELP}`); process.exitCode = 1; }
  else {
    const report = await checkPage(options.url);
    const defaultThresholds = options.htmlBytes === DEFAULT_HTML_BYTES && options.imageBytes === DEFAULT_IMAGE_BYTES;
    console.log(options.json ? JSON.stringify(report, null, 2) : defaultThresholds ? formatReport(report) : formatWithThresholds(report, options));
    if (options.failOnIssues && hasIssues(report, options)) process.exitCode = 2;
  }
} catch (error) {
  console.error(`Check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
