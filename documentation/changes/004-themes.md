# Website themes
Status: done (pending manual review)

## Acceptance criteria
- [x] Default theme is green "Leaf" with a leaf pattern/glyph; the original look is kept as "Neon".
- [x] Extra themes: Ocean, Ember.
- [x] Theme picker (swatches) in the header of every page; choice saved in localStorage and applied before first paint.
- [x] If the picker cannot work (no JavaScript, blocked storage, unknown saved name) the site stays on the green theme.
- [x] All colours come from CSS variables; no hard-coded accent colours in page styles.
- [x] Tests for the theme list and name normalization.

## Constraints
- Default theme lives on `:root` in `src/styles/theme.css`; others override via `[data-theme]` on `<html>`.
- Keep `THEMES` in `src/lib/theme.ts` and the CSS in sync when adding a theme.

## Reference implementation
- `src/lib/theme.ts`, `src/styles/theme.css`.

## Remaining work
- None.
