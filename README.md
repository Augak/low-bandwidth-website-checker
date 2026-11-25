# Low-Bandwidth Website Checker

Clearpage is a local visual interface and TypeScript command-line tool for checking HTML size, image alt attributes, image sizes and links.

## Getting started

Requires Node.js 20.18.1 or newer and npm.

```sh
npm install
npm run web
```

Open http://127.0.0.1:4173 and enter the website URL. The server is bound to the local machine only. Set PORT to use another local port.

For the command-line version and tests:

```sh
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

Only check URLs you trust and are authorized to access. The tool requests linked resources and follows redirects, including links to internal networks. The interface runs locally and checks request origins, but it is not designed for public hosting. Do not expose it as a public service without robust SSRF protection, resource limits and other security controls.
