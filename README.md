# Clearpage — Low-Bandwidth Website Checker

Clearpage helps developers spot a few potential barriers for people on limited connections: large HTML or images, missing image alt attributes, and links that return errors. Run the visual interface locally, or use the TypeScript command-line tool. It is a quick diagnostic, not a complete performance or accessibility audit.

## Get started

You need Node.js **20.18.1 or newer** and npm. From a terminal:

```sh
git clone https://github.com/Augak/low-bandwidth-website-checker.git
cd low-bandwidth-website-checker
npm install
npm run web
```

Open **http://127.0.0.1:4173**, enter a trusted website URL, and run a check. The server listens on your local machine; press Ctrl+C to stop it. To use another port, for example, run `PORT=4174 npm run web` and open http://127.0.0.1:4174.

Alternatively, use the command line:

```sh
npm run check -- https://example.com
```

Use a full HTTP(S) URL without embedded credentials. A failed page request produces an error rather than a report.

### Automation and budgets

```sh
npm run check -- --json https://example.com
npm run check -- --fail-on-issues --html-threshold-bytes 102400 --image-threshold-bytes 204800 https://example.com
npm run check -- --help
```

`--json` emits the actual report for scripts. `--fail-on-issues` exits with code 2 when a sampled image or link has an error, an image lacks alt text, or measured HTML or image sizes exceed the configured byte thresholds. Exit code 1 means invalid input or a failed page request; 0 means the check completed and, if enabled, found none of those issues. Unknown image sizes and unchecked resources are not counted as passing measurements. For CI, install Node 20.18.1 or newer and dependencies, then run the second command against a URL you are authorized to check. These are sampled checks, not a total page-weight budget.

## Understanding a report

- **Decoded HTML:** UTF-8 byte length of the decoded HTML text, not network transfer size. Pages over 100 KiB get a suggestion.
- **Missing alt:** Counts `<img>` elements without an `alt` attribute. An empty `alt` is appropriate for decorative images; the tool cannot judge whether alt text is useful.
- **Images:** Checks up to 20 unique HTTP(S) `img src` URLs and flags reported sizes over 200 KiB. Sizes come from response headers and may be missing, inaccurate, or differ from actual transferred bytes.
- **Links:** Checks up to 25 unique HTTP(S) links and reports request errors or HTTP errors. Access restrictions or automated-request blocking can produce errors even when a link works in a browser.

Resource checks use HEAD, falling back to a range GET when HEAD returns 405 or 501. Counts show how many unique resources were checked versus found. Results are a snapshot and depend on the server's response.

Clearpage parses the initial static HTML; it does not execute JavaScript or measure `srcset`, CSS images, scripts, stylesheets, total page transfer, load time, or real-world mobile performance. Use browser developer tools or other audits alongside it.

## Safety and responsible use

Only check pages and resources you trust and are authorized to access. The checker requests linked resources and follows redirects, including to internal networks. The local interface checks request origins, but that is not comprehensive protection against server-side request forgery. **Do not expose it as a public service** without robust SSRF protection, resource limits and other security controls. Avoid sharing private URLs, tokens or sensitive report details in public issues.

## Contributing

Bug reports, documentation improvements and reproducible examples are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests and pull request guidance, or [open an issue](https://github.com/Augak/low-bandwidth-website-checker/issues/new/choose).
