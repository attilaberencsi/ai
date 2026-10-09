---
paths:
  - "src/**"
---

# Frontend conventions

- TypeScript (strict) for all source; the build writes to `docs/`, which GitHub Pages serves. Never edit `docs/` by hand.
- Must build to static assets deployable under a GitHub Pages sub-path (use relative/base-aware URLs).
- Vue: Composition API with `<script setup>`; keep components small and presentational where possible.
- Plain JS pages stay dependency-free; use ES modules.
- Load registry data via fetch from static files; handle loading and error states.
- Accessibility basics: semantic HTML, keyboard-operable controls, labels on inputs.
- Toolchain: Vite (multi-page, root `src/pages`) + Vue 3 + TypeScript + vitest. New pages must be added to `rollupOptions.input` in `vite.config.ts`.
- Put logic in `src/lib` as pure functions with unit tests; keep components thin.
