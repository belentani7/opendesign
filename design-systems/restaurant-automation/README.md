# Restaurant Automation — design system

A black-premium token set for high-end restaurant automation products:
POS screens, kitchen displays, reservation flows and printed menus.

- **Status:** v1.0.0, stable
- **License:** [MIT](../../LICENSE) — free for personal and commercial use
- **Files:** [`tokens/tokens.json`](tokens/tokens.json) (source of truth) · [`tokens/colors_and_type.css`](tokens/colors_and_type.css) (hand-written CSS variables)

Open either file in the gallery to see it rendered: colours become swatches,
the type scale becomes a specimen, and the raw source is always one click away.

## Structure

Tokens follow a primitive → semantic split so a theme change touches one layer only.

| Layer | Example | Use it for |
| --- | --- | --- |
| `color.primitive.*` | `black-raised: #1A1A1A` | The palette itself. Never referenced by UI directly. |
| `color.semantic.*` | `background.card`, `text.accent` | What components consume. |
| `typography.*` | `fontSize.display-xl`, `fontFamily.display` | Type scale and families. |
| `spacing.*` / `borderRadius.*` / `shadow.*` | `spacing.6`, `shadow.glow-gold` | Layout and elevation. |
| `transition.*` / `zIndex.*` / `breakpoint.*` | `transition.easing.premium` | Motion, stacking, responsive rules. |

## The accent

One accent, used sparingly — gold `#C9A84C`, with champagne `#F7E7CE` and copper
`#B87333` as supporting tones. Semantic status colours (red / amber / green / blue)
stay at their standard values so operators can read them at a glance.

## Usage

```html
<link rel="stylesheet" href="../../design-systems/restaurant-automation/tokens/colors_and_type.css" />
```

```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-surface-border);
  color: var(--color-text-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glow-gold-sm);
}
```

> `tokens.json` is written in a [DTCG](https://tr.designtokens.org/format/)-compatible
> shape (`{ "value", "type" }`), so it can be piped into Style Dictionary or any
> other token compiler without reshaping.

## Contributing

Add or change a token in `tokens.json`, mirror it in `colors_and_type.css`, bump
`version`, and run `npm run build` so the gallery re-indexes the file. See
[CONTRIBUTING.md](../../CONTRIBUTING.md).
