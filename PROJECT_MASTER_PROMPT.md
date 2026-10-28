# PROJECT MASTER PROMPT — OpenDesign

## Canonical identity and source of truth
OpenDesign is the existing `belentani7/opendesign` repository: a free MIT-licensed, static, zero-runtime-dependency viewer of real design artifacts stored in `mockups/` and `design-systems/`. Do not confuse it with independent design/creative repositories. The canonical behavior is the current source code, tests, artifact tree and README on the default branch; do not invent launch or business claims.

## Maximum useful product vision
A dependable, offline-capable design workbench: users can browse projects, filter and search, deep-link into artifacts, preview real HTML/prototypes/documents, inspect source safely, review colors and typography from token files, and share reproducible responsive views. Scale this product by making artifact discovery and review more useful while preserving its no-account, no-tracking, no-build-to-view promise. Accessibility and predictable keyboard operation are essential.

## Architecture to preserve
- `index.html`, `assets/app.js`, and `assets/styles.css`: native browser UI and state.
- `scripts/build-manifest.mjs` and `scripts/lib/manifest.mjs`: scan local artifact sources to regenerate `manifest.json`, `manifest.js` and sitemap.
- `scripts/serve.mjs`: development server using Node standard libraries.
- `tests/*.test.mjs`: Node's built-in test runner, plus jsdom for DOM tests.
- No third-party runtime services, telemetry, external script CDNs, unnecessary frameworks, mandatory accounts or payment provider.
- Keep previews scoped to files in the repository. Do not let stale asynchronous responses overwrite currently selected artifacts or source drawers. Explicitly handle invalid routes, URLs, malformed zoom, network failures and missing files.

## Concrete delivery sequence
1. **Reliability and protection:** ensure route/hash/zoom inputs are safe, previews and source fetches are race-free, errors are explicit and dangerous link protocols are blocked. Prove cases with regression tests.
2. **Artifact review:** improve navigation, useful metadata, resilient responsive device previews, source accessibility, keyboard and screen reader behavior.
3. **Discovery:** keep grouping, fuzzy search and generated indexes deterministic. Add better filters and metadata only if sourced from actual files.
4. **Interoperability:** token presentation, copyable source references, portable and shareable deep links; preserve direct file opening and offline fallback.
5. **Release gate:** run `npm run verify`, review failing tests, audit accessibility and CSP/iframe trade-offs, and smoke-test both local HTTP and file:// modes. CI failure without executed steps is NOT test success.

## Agent operating instruction
On every iteration: read the current main branch, latest open PRs, full relevant code and tests before editing. Choose a missing *functional* behavior; implement a narrow, production-quality change in this existing repository, add a regression test that exercises shipped code, run checks if an executor is available, and open a focused reviewable PR. Never replace working content with generic scaffolding, delete historical mockups, publish private data, force-push, merge unverified changes, or claim deployment without evidence. Once a targeted deliverable is verified, continue to the next meaningful capability or the next separate historical repository.

## Current checkpoint (2026-10-23)
Branch `fix/async-preview-source-20261023`: safeguard against stale preview/source read completion, report source HTTP errors, neutralize control-character URL schemes and recover invalid zoom values. Code and regression cases are committed; end-to-end verification and any deployment remain pending until executed checks pass.
