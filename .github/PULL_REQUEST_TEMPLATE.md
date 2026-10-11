## What

<!-- One or two sentences: what changed and why. Link the issue, e.g. "Fixes #12". -->

## Why

<!-- The problem, not the diff. What was broken or missing? -->

## How it was verified

<!--
Paste the tail of `npm run verify`. If you fixed a bug, name the test that fails
without your change and passes with it.
-->

```
# npm run verify
```

## Checklist

- [ ] `npm run verify` is green (validate + manifest drift + tests)
- [ ] `manifest.json` and `manifest.js` regenerated if artifacts changed
- [ ] New behaviour is covered by a test that exercises the real code path
- [ ] No new runtime dependency, no remote request added to `index.html`
- [ ] Keyboard reachable, labelled and announced; works in dark and light
- [ ] Docs / CHANGELOG updated
