import { checkPage, formatReport } from "./checker.js";
const url = process.argv[2];
if (!url || url === "--help" || url === "-h") { console.log("Usage: npm run check -- https://example.com"); process.exitCode = url ? 0 : 1; }
else { try { console.log(formatReport(await checkPage(url))); } catch (error) { console.error(`Check failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; } }
