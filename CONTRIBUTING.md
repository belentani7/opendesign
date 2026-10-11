# Contributing to OpenDesign

Thanks for taking the time — this project is MIT licensed and intentionally tiny, so
contributions are easy to review.

## Ground rules

- **No runtime dependencies.** The gallery must keep working as plain HTML + CSS + ES
  modules, offline, with no CDN and no tracking. Dev dependencies for tests are fine.
- **No build step to *view*.** Generated files (`manifest.json`, `manifest.js`) are
  committed so the site works straight from disk.
- **Accessibility is not optional.** Every control needs a name, a keyboard path and a
  visible focus ring. Honour `prefers-reduced-motion`.
- **Keep it honest.** If you add a feature, add a test that exercises the real code path.

## Getting started

```bash
git clone https://github.com/belentani7/opendesign.git
cd opendesign
npm install      # only needed for `npm test` (jsdom)
npm run dev      # http://localhost:8080
```

Node ≥ 18. Everything except the tests runs on the standard library alone.

## Adding a mockup

1. Create `mockups/<kebab-name>/` and put an `index.html` in it (plus any assets).
2. Give the page a real `<title>` — it becomes the subtitle in the file tree.
3. Run `npm run build` and commit the updated `manifest.json` **and** `manifest.js`.
4. Prefer self-contained pages: inline CSS is fine, and if you must use a CDN, make the
   page degrade gracefully when it is blocked (see the `no3d` fallback in
   `mockups/historia-que-recuerda/`).

## Adding a design system

1. Create `design-systems/<name>/` with `tokens/tokens.json` and/or `tokens/*.css`.
2. Write a `README.md` for it — it renders as Markdown inside the gallery.
3. Use the DTCG shape (`{ "value", "type" }`) for `tokens.json` so it can be compiled by
   Style Dictionary or similar without reshaping.
4. `npm run build`, then commit the manifests.

## Before you open a pull request

```bash
npm run verify   # validate + manifest drift check + full test suite
```

That is exactly what CI runs. If it passes locally, CI will pass.

### Review checklist

- [ ] `npm run verify` is green.
- [ ] `manifest.json` / `manifest.js` regenerated and committed.
- [ ] New behaviour has a test in `tests/` (helpers, DOM, or mockup suite).
- [ ] No new runtime dependency, no remote request from `index.html`.
- [ ] New controls are keyboard reachable and announced (`aria-*`, `aria-live`).
- [ ] Dark **and** light theme look right; the layout survives a 360 px viewport.
- [ ] Docs updated if you changed a script, shortcut or manifest field.

## Commit style

Conventional commits, imperative mood, one logical change each:

```
fix(mockup): keep pointer state in scope so the render loop runs
feat(viewer): add tablet viewport
docs(readme): document the validate checks
```

## Reporting problems

Use the [issue templates](.github/ISSUE_TEMPLATE). For anything security-related, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

Be kind, be specific, assume good faith: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
