# Historia que recuerda — NOIACORE

An experimental, "impossible website" prototype: a cosmic eye that remembers its
visitors. Built as **prototype #91** of a series exploring interfaces that feel
slightly too aware of you.

- **Language:** Spanish
- **Status:** playable prototype
- **Persistence:** `localStorage` only (no server, no tracking)

## How it behaves

1. **The eye.** A WebGL icosahedron with a shader iris and a particle galaxy, driven by
   three.js from a CDN. If the CDN or WebGL is unavailable the page falls back to a CSS
   starfield — it never shows a dead screen.
2. **Memory.** It counts visits and accumulated time, remembers your name, and reveals a
   per-visitor *Phi signature* — a Zeckendorf (Fibonacci) bit-string of your name.
3. **A short story in four states:** the eye, your name, the truth, the void.

## Controls

| Key / action | Effect |
| --- | --- |
| type a name + <kbd>Enter</kbd> | advance and register the visitor |
| <kbd>← / →</kbd> buttons | previous / next state |
| <kbd>R</kbd> (on the last state) | wipe the memory and restart |

## Notes for contributors

- The render loop's pointer state (`mx`, `my`) must live at module scope — both
  `init3D()` and `tick()` read it. A regression test (`tests/mockup.test.mjs`) executes the
  page in jsdom and fails if a frame ever throws again.
- Keep external dependencies CDN-based **and** optional; the page must degrade gracefully.
- Never log visitor `localStorage` contents to the console.

The design tokens behind it live in
[`design-systems/restaurant-automation`](../../design-systems/restaurant-automation).
