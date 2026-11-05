# Meridian theming contract

The repository currently ships with Holden's personal `holden-console` theme. It is intentionally separate from Meridian's analysis, import, and workflow code.

## Personal build

- `index.html` loads `src/styles.css` first and `src/theme-holden.css` second.
- `src/styles.css` owns shared layout, responsive behavior, accessibility, and fallback design tokens.
- `src/theme-holden.css` owns the personal black-and-gold console identity, decorative effects, and theme-specific component treatment.
- The `data-theme="holden-console"` attribute identifies the active edition.

## Customer distribution

For a customer edition:

1. Copy `src/theme-holden.css` to a customer-named theme file.
2. Replace its colors, typography, borders, motion, and decorative effects.
3. Update the theme stylesheet link and `data-theme` value in `index.html`.
4. Replace build labels, title, logo, and customer-facing wording.
5. Run `node tests/run-all.js` and complete a visual check at desktop and mobile widths.

Do not place customer branding inside `src/analysis.js`, `src/workbook-import.js`, or process calculations. The process map reads its palette from the `--chart-*` CSS variables, so it changes with the selected theme.

## Accessibility rules

- Preserve visible keyboard focus.
- Keep normal text and operational values readable against their surfaces.
- Keep red reserved for errors or critical exceptions.
- Respect reduced-motion preferences.
- Do not use decorative textures as the only way to communicate status.
