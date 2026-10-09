# Site scaffold and landing page
Status: done (pending manual review)

## Acceptance criteria
- [x] TypeScript + Vite + Vue (multi-page build) set up; `npm run build` outputs to `docs/` with a base path that works on GitHub Pages.
- [x] `docs/.nojekyll` produced; docs/ is committed output.
- [x] CLAUDE.md Verification section filled with real build/lint/typecheck/test commands.
- [x] Landing page: futuristic look (dark, glow/gradient, subtle animation, respects prefers-reduced-motion), three large cards: MCP Servers, Agents, Skills.
- [x] MCP Servers card links to the working page; Agents and Skills show a "coming soon" state.
- [x] Shared layout/styles (header, nav, theme tokens) reusable by all pages.
- [x] Decision logged for the toolchain.

## Constraints
- Static output only; relative/base-aware URLs.
- Dependencies limited to: vue, vite, typescript, vue-tsc, vitest (ask before more).

## Reference implementation
- None yet (this change establishes it).

## Remaining work
- None.
