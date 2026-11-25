# Low-Bandwidth Website Checker

A TypeScript command-line tool for checking HTML size, image alt attributes, image sizes and links.

## Getting started

Requires Node.js 20.18.1 or newer and npm.

```sh
npm install
npm run check -- https://example.com
npm test
npm run typecheck
```

## What it checks

- Decoded HTML size, flagging pages over 100 KiB. This is not the total transfer size.
- Images missing alt attributes. Empty alt is valid for decorative images.
- Up to 20 unique HTTP(S) image src URLs. Reported sizes over 200 KiB are flagged; unknown sizes are shown.
- Up to 25 unique HTTP(S) links, reporting errors. Some sites block automated requests.

HEAD requests fall back to a range GET when HEAD is not supported. The tool uses static HTML, so JavaScript-rendered content, srcset, CSS images, scripts, stylesheets and total transfer size are not measured.

## Responsible use

Only check URLs you trust and are authorized to access. The tool requests linked resources and follows redirects. Do not expose it as a public service without SSRF protection, resource limits and other security controls.
