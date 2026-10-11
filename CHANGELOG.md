# Changelog

All notable changes to this project. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-11

A full rebuild: the viewer was redesigned from scratch, the repository was audited and the
bugs found were fixed, and the project was made genuinely open source and free to run.

### Added

- **New viewer UI** — graphite + gold studio shell built on this repo's own design tokens:
  icon sprite, collapsible artifact tree with titles and sizes, stage with device frames,
  status bar, source drawer, command palette, toast and help dialog.
- **Device previews**: Fill, Desktop 1440, Laptop 1280, Tablet 834, Mobile 390, with
  20–200 % zoom, fit-to-stage, and per-device persistence.
- **Deep links** — `#/path?device=mobile&zoom=0.5`, kept in sync with history so back/forward
  and shared URLs land on the same view.
- **Command palette** (<kbd>⌘K</kbd>) with fuzzy ranking across label, title, group and path.
- **Token specimens** — `.css` files render as colour swatches + type scale; DTCG `.json`
  token files render as a token gallery; Markdown renders as documentation; everything else
  renders as highlighted source.
- **Source drawer** with line numbers, syntax highlighting and copy-to-clipboard.
- **Themes** — dark, light and follow-the-OS, persisted in `localStorage`.
- **Keyboard control** for every action, plus <kbd>?</kbd> help.
- **Accessibility** — skip link, ARIA state on every control, roving tabindex, arrow-key
  navigation, `aria-live` announcements, `prefers-reduced-motion` support.
- **Responsive layout** — the tree becomes a drawer below 900 px; the shell uses `100dvh`.
- **`scripts/build-manifest.mjs`** — scans `mockups/` and `design-systems/`, records kind,
  byte size and document title, writes `manifest.json` and the `manifest.js` fallback.
- **`scripts/validate.mjs`** — eight repo health checks, replacing the old "index.html is
  not empty" CI step.
- **`scripts/serve.mjs`** — dependency-free dev server bound to `0.0.0.0`, with path
  traversal protection.
- **Test suites** (`node --test` + jsdom): pure helpers, manifest integrity, an end-to-end
  DOM suite that drives the real `createApp()`, and mockup regression tests.
- **CI**: `validate` + manifest drift check + tests on every push and PR, plus a GitHub
  Pages deployment workflow (free hosting).
- **Community files**: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue
  templates and a pull request template.
- `design-systems/restaurant-automation/README.md` — the token set now documents itself.
- `404.html`, an inline SVG favicon, and full SEO/social metadata on the shell.

### Fixed

- **`manifest.json` shipped the literal string `"$ts"`** as its `generated` value. It is now
  a real ISO timestamp, and CI fails if it is not.
- **The `design-systems` section was empty** in the manifest, so
  `design-systems/restaurant-automation/tokens/*` was unreachable from the viewer. Both
  token files are now indexed and rendered.
- **Mockup: the 3D eye never rendered.** `mx`/`my` were declared inside `init3D()` but read
  by its sibling `tick()`, so every animation frame threw
  `ReferenceError: mx is not defined`. The pointer state now lives at module scope, and a
  regression test executes the page in jsdom to prove it.
- **Mockup: `renderer.outputEncoding = THREE.sRGBEncoding`** used API removed in three.js
  r155 (it silently assigned `undefined`). Replaced with a guarded `outputColorSpace`.
- **Mockup: accumulated visit time grew quadratically** because each interval re-read
  `localStorage` and added the session again. It now uses the load-time baseline.
- **Mockup: the `.mid.knows` CSS never applied** because the class was set on `<body>`
  instead of `#mid`.
- **Mockup: a blocked CDN meant a dead black page.** Missing three.js or WebGL now falls
  back to a CSS starfield.
- **Mockup: visitor `localStorage` keys were logged to the console.** Removed.
- **`README.md` claimed "License: not specified"** while an MIT `LICENSE` file existed. The
  license is now stated and badged, and the validator enforces it.
- **No favicon** — browsers 404'd on every load. Now an inline SVG.
- **No `file://` support** — the viewer depended on `fetch()`. `manifest.js` provides a
  script-based fallback.
- Markdown links are protocol-checked, so `javascript:`/`data:` targets cannot be injected.

### Changed

- `index.html` is now a semantic shell with an SVG icon sprite; all styling lives in
  `assets/styles.css` and all logic in `assets/app.js`.
- The manifest schema moved to `version: 2` with `counts`, per-file `kind`/`bytes`/`title`,
  section icons and hints.
- CI no longer overwrites `ci.yml` from a generator; it is a maintained workflow.
- README rewritten: what it is, how to run it, how to add artifacts, what CI checks.

### Removed

- The dependency on the proprietary `opendesign` skill for creating mockups — the README
  and `CONTRIBUTING.md` document the plain-filesystem workflow instead.
- The old fixed 240 px dark sidebar UI.

[2.0.0]: https://github.com/belentani7/opendesign/releases/tag/v2.0.0
