# Decisions

Durable architectural decisions only. One entry each: date, decision, why. No routine edits.

## 2026-10-09 - Lightweight spec-driven workflow without a spec framework
Use CLAUDE.md + path-scoped rules + one `/implement` skill + short change docs.
Why: minimal token cost; consistency comes from reference implementations and checks, not heavy specs.

## 2026-10-09 - Static hosting on GitHub Pages
Registry is static data; no backend. Why: free hosting, simple, matches the product goal.

## 2026-10-09 - TypeScript source, build output in `docs/`
GitHub Pages can serve only root or `/docs`, so the build outputs to `docs/` (committed, generated).
Project documentation lives in `documentation/` instead. Why: matches Pages constraints without a deploy workflow.

## 2026-10-09 - Website first, not a registry API
Not implementing the registry REST API on Pages (query params/search/pagination can't work statically).
Instead: a catalog website with a landing page and MCP Servers / Agents / Skills pages, reading static JSON.
Why: the goal is a polished browsing/install experience; API compatibility comes later via a real server.

## 2026-10-09 - Registry-conformant JSON "db" with extension fields in `_meta`
Each server entry is `{ server, _meta }` as in the official registry. `server` must validate against the pinned
`server.schema.json` (pin a commit/tag, not `main`). Our extra fields (category, per-client install overrides, icon, tags)
live under a reverse-DNS key in `_meta`, e.g. `io.github.attilaberencsi/catalog`.
Why: server objects stay schema-valid and importable by a future real registry; extensions use the spec's sanctioned extension point.

## 2026-10-09 - Toolchain: Vite + Vue 3 + TypeScript 5.9 + vitest
Multi-page build (root `src/pages`, output `docs/`, `base: './'`). Other dev deps: ajv + ajv-formats (schema validation), tsx (scripts), vue-tsc.
TypeScript pinned to ~5.9 because vue-tsc 3.3 does not work with TypeScript 7.

## 2026-10-09 - Pinned registry schema
`registry/schema/server.schema.json` copied from modelcontextprotocol/registry at commit 970df037919faa70456dde08c295473002d850e5
(docs/reference/server-json/draft/server.schema.json). Update deliberately, re-run `npm run validate:registry`.

## 2026-10-09 - Install links
VS Code (`vscode:mcp/install?`), Cursor (`cursor://...mcp/install`) are real deep links. No official Claude MCP install link exists:
claude.ai connector prefill (`?modal=add-custom-connector&connectorName&connectorUrl`) is unofficial/unverified; `claude-cli://open?q=` only pre-fills a prompt.

## 2026-10-09 - Install scopes modelled as user / project / local
One shared Scope enum; each client declares which it supports and falls back to user (or its only scope) otherwise.
Where a client has no CLI/deep-link for a scope (VS Code workspace, Cursor project, Codex project), we output the config-file snippet instead.

## 2026-10-10 - Themes via CSS variables, green default
Default green "leaf" theme is the `:root` styling, so it is also the fallback when no theme can be applied. Other themes (neon = the original look, ocean, ember) override variables with `[data-theme]` on `<html>`; choice stored in localStorage (`ai-library-theme`), applied by a tiny inline script in each page head.
