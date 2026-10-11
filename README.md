<div align="center">

# OpenDesign

**A free, MIT-licensed, zero-dependency static gallery for design mockups and design systems.**

Every artifact in the repo — prototypes, tokens, docs — previewable in the browser,
with device frames, deep links, a command palette and no account, paywall or tracking.

![License: MIT](https://img.shields.io/badge/license-MIT-c9a84c)
![Dependencies](https://img.shields.io/badge/dependencies-0-success)
![Build](https://img.shields.io/badge/build-static-blueviolet)
![Cost](https://img.shields.io/badge/cost-%240-success)

[Browse the source](https://github.com/belentani7/opendesign) ·
[Report a bug](https://github.com/belentani7/opendesign/issues/new/choose) ·
[Contribute](CONTRIBUTING.md) ·
[Changelog](CHANGELOG.md)

</div>

> **En español:** OpenDesign es una galería estática, gratuita y de código abierto (MIT)
> para mockups y sistemas de diseño. Sin dependencias, sin servidor, sin registro y sin
> coste: clona el repositorio, abre `index.html` y listo.

---

## Why

Design work usually ends up scattered: a Figma link nobody can open offline, a folder of
PNGs, a Slack thread. OpenDesign keeps the artifacts **in the repo**, next to the code,
and gives them a viewer good enough to review, share and hand off.

- **Free forever.** MIT license — use it, fork it, ship it, sell what you build with it.
- **Zero runtime dependencies.** No framework, no bundler, no CDN, no analytics. The app is
  plain HTML + CSS + ES modules, so it works offline and will still open in ten years.
- **Zero cost to host.** Any static host works: GitHub Pages, Netlify, an S3 bucket, or
  `python3 -m http.server` on your laptop.
- **Nothing is hidden.** The source drawer shows the real file behind every preview.

## Try it in 30 seconds

```bash
git clone https://github.com/belentani7/opendesign.git
cd opendesign
npm run dev          # → http://localhost:8080
```

No install step is required — `npm run dev` uses only Node's standard library.
In a hurry? Just open `index.html` in a browser; the viewer falls back to the
generated `manifest.js` because `fetch()` is blocked on `file://`.

## Shipped apps

| Artifact | What it is |
| --- | --- |
| **Berentani Studio 7** | A self-contained "glass + red neon" laboratory — mixer, spectrum, test chamber, archive and seal config. Fully offline: no APIs, no internet, free. |
| **Historia que recuerda** | An experimental WebGL "cosmic eye" prototype with persistent memory. |
| **restaurant-automation** | A black-premium design token set that renders as swatches + type scale. |

## What you get

| | |
| --- | --- |
| **Artifact tree** | Every file under `mockups/` and `design-systems/`, grouped, titled and sized. |
| **Device frames** | Fill · Desktop 1440 · Laptop 1280 · Tablet 834 · Mobile 390, with zoom 20–200 %. |
| **Deep links** | `#/mockups/foo/index.html?device=mobile&zoom=0.5` — copy it, share it, it lands on the same view. |
| **Command palette** | <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> fuzzy search across every artifact. |
| **Presentation mode** | <kbd>P</kbd> hides everything but the artifact; <kbd>Esc</kbd> returns to the studio. |
| **Token specimens** | `.css` and `.json` token files render as colour swatches and a type scale — not as raw text. |
| **Markdown** | Repo docs render in place, so a design system can document itself. |
| **Source drawer** | <kbd>S</kbd> shows the highlighted source with line numbers and a copy button. |
| **Themes** | Dark, light or follow the OS — persisted per browser. |
| **Accessible** | Keyboard-first, roving tabindex, ARIA state, `prefers-reduced-motion`, skip link. |

## Keyboard

<kbd>⌘K</kbd> search · <kbd>/</kbd> filter · <kbd>↑↓</kbd> browse · <kbd>D</kbd> viewport ·
<kbd>F</kbd> fit · <kbd>[ ]</kbd> zoom · <kbd>0</kbd> reset zoom · <kbd>S</kbd> source ·
<kbd>R</kbd> reload · <kbd>C</kbd> copy link · <kbd>O</kbd> open · <kbd>T</kbd> theme · <kbd>P</kbd> present ·
<kbd>?</kbd> help

## Repository layout

```
index.html               the gallery shell
manifest.json            generated index of every artifact
manifest.js              same data as a script, for file:// usage
sitemap.xml              generated; lists every artifact for search engines
robots.txt               allows all crawlers; points at the sitemap
assets/                  styles.css, app.js, favicon.svg
scripts/
  build-manifest.mjs     scans the repo → manifest.json + manifest.js + sitemap.xml
  make-og-image.sh       regenerates assets/og-image.png (needs ImageMagick; optional)
  validate.mjs           repo health checks (see below)
  serve.mjs              dependency-free dev server
  lib/manifest.mjs       shared scanning/parsing helpers
tests/                   node:test suites (helpers, manifest, DOM, mockup)
mockups/<name>/          interactive prototypes, one folder each
design-systems/<name>/   tokens, themes and their documentation
```

## Add your work

**A mockup**

```bash
mkdir -p mockups/my-prototype
# put index.html (plus any assets) in it
npm run build
```

**A design system**

```bash
mkdir -p design-systems/my-system/tokens
# add tokens.json and/or tokens.css, plus a README.md
npm run build
```

`npm run build` re-indexes everything: it records each file's kind, byte size and
document title, so the tree and the search stay accurate. Commit `manifest.json`
and `manifest.js` — CI fails if they drift from the files on disk.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Serve the repo on `http://localhost:8080` (Node stdlib only). |
| `npm run build` | Re-scan the repo and rewrite `manifest.json` + `manifest.js` + `sitemap.xml`. |
| `npm run check:manifest` | Fail if the committed manifest is stale. |
| `npm run validate` | Repo health checks — see below. |
| `npm test` | Run every suite with `node --test`. |
| `npm run verify` | `validate` + `check:manifest` + `test` (what CI runs). |

`npm install` is only needed for `npm test` (jsdom). Everything else runs on a bare Node ≥ 18.

## What `npm run validate` checks

1. `manifest.json` parses and matches the current schema version.
2. `generated` holds a real ISO timestamp (an earlier revision shipped the literal `"$ts"`).
3. Every path in the manifest exists on disk.
4. Every artifact on disk is reachable from the manifest — no orphans.
5. Every HTML file has a doctype, `lang`, charset, viewport and title, balanced tags,
   and no dead local links.
6. Every JSON file parses.
7. The shell declares its SEO/social meta tags and makes **no** third-party requests.
8. The MIT license is present and stated in the README.

## Deploying (free)

Pushing to `main` publishes the gallery to GitHub Pages via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). It needs one manual switch
the first time — **Settings → Pages → Build and deployment → Source: GitHub Actions** —
and it then serves the repo at `https://<user>.github.io/opendesign/` at no cost.

Any other static host works identically: upload the folder as-is, there is no build
output to produce. Because the shell makes no third-party requests, it also works from a
`file://` URL or an air-gapped machine.

## Design tokens

The viewer is styled with the palette from its own
[`design-systems/restaurant-automation`](design-systems/restaurant-automation) token set —
black-premium surfaces with a single gold accent (`#C9A84C`). Override the custom
properties in `assets/styles.css` to rebrand it.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
conventions and the review checklist. Please read the
[Code of Conduct](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## License

MIT © [Pedro Belentani (belentani7)](https://github.com/belentani7) — see [LICENSE](LICENSE).
Free for personal and commercial use, with no attribution requirement beyond keeping the
license text.
