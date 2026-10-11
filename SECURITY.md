# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 2.x | ✅ yes |
| 1.x and earlier | ❌ no |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

1. Email the maintainer: **belentani7@users.noreply.github.com**, or use the private
   vulnerability reporting form on the repository's **Security → Report a vulnerability**
   tab if it is enabled.
2. Describe the affected version, the steps to reproduce, and the impact.
3. Give us a reasonable window (aim: 90 days) before public disclosure.

We will acknowledge within a few days, keep you informed while a fix is prepared, and
credit you in the changelog unless you ask us not to.

## Threat model

OpenDesign is a static site with no server-side code, no accounts and no user data, which
keeps the surface small. The things we do care about:

- **Untrusted artifacts.** Mockups are user-contributed HTML rendered inside a sandboxed
  `<iframe>` (`allow-scripts allow-same-origin allow-forms allow-popups allow-modals
  allow-downloads` — notably **no** `allow-top-navigation`). Review contributed mockups
  before deploying them to a shared host; treat them as you would any third-party script.
- **Injected markup.** Every string that reaches `innerHTML` goes through `escapeHtml()`
  first — file names, document titles, Markdown and source code included. If you find a
  path that bypasses it, that is a security bug: please report it.
- **Path traversal.** `scripts/serve.mjs` resolves requests inside the repository and
  refuses to escape it. It is a development server — do not expose it to the internet.
- **Supply chain.** There are no runtime dependencies. `jsdom` is a dev-only dependency
  used by the test suite.

If you spot something that does not fit these categories but still looks wrong, open an
issue — most reports are not vulnerabilities and public discussion is fine for those.
