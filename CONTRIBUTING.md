# Contributing to Clearpage

Thanks for helping make the web more usable on limited connections. Reports, documentation, tests and code are welcome.

## Set up and test

1. Fork and clone the repository, then enter its directory.
2. Install Node.js 20.18.1 or newer and npm, then run `npm install`.
3. Run `npm run web` for the local interface at http://127.0.0.1:4173, or `npm run check -- https://example.com` for the CLI. Check only URLs you trust and are authorized to access.
4. Before opening a pull request, run:

   ```sh
   npm run typecheck
   npm test
   ```

Tests use local HTTP fixtures. For behavior changes, add or update tests where practical, including cases for errors and measurement limits. Keep documentation and examples consistent with the actual behavior; do not imply that header-based sizes are total network transfer or that static HTML analysis is a full audit.

## Issues and pull requests

- Search existing issues and pull requests before starting. For a larger change, open an issue first to discuss the approach.
- For bugs, include steps to reproduce, expected and actual behavior, environment details and a minimal example. Redact private URLs, credentials and personal data; use a local fixture where possible.
- For feature requests, explain the user need and any proposed approach or trade-offs.
- Work on a branch and open a focused pull request describing the change, why it is useful, and how you tested it. Link the related issue when applicable. Note any limitations or tests you could not run.
- Be respectful and constructive in discussion and review.

The interface is for local use. Changes involving URL fetching, redirects or network exposure need careful security review; do not assume local origin checks make public hosting safe. Avoid posting exploitable details or secrets in a public issue. If you find a security concern, contact the repository owner privately where possible.
