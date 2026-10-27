# Project

A futuristic-looking catalog website on GitHub Pages: landing page leading to MCP Servers,
Agents and Skills pages. Pages are HTML + TypeScript (some Vue), fed by JSON "db" files whose
shape follows the official MCP registry `server.json` schema, so a real registry server can
reuse the data later. No backend, no server-side code. Not a full registry API implementation.

# Constraints

- Source is TypeScript; the build outputs to `docs/` (the only folder besides root GitHub Pages can serve).
- Everything must work as static files on GitHub Pages (no server runtime, no secrets).
- Registry data is the source of truth; pages read it, they never duplicate it.
- Follow the nearest existing implementation before introducing a new pattern.
- Do not add dependencies, change the data schema, or change the build/deploy setup without approval.
- Do not perform unrelated refactoring.

# Layout (update as it becomes real)

- `registry/servers.json` and `registry/skills.json` - the JSON "db" files; `registry/schema/server.schema.json` - pinned official schema; `registry/schema/skills.schema.json` - our skills schema; `scripts/` - validation and reference checks (see `.claude/rules/registry-data.md`)
- `docs/` - BUILD OUTPUT served by GitHub Pages ("/docs" folder). Generated; never hand-edit.
- `src/pages/` (HTML entry points + their TS), `src/components/` (Vue), `src/lib/` (pure logic, unit-tested), `src/styles/` (see `.claude/rules/frontend.md`)
- `documentation/decisions.md` - durable architectural decisions
- `documentation/changes/` - one short file per feature (copy `_template.md`)

# Reference

- The `mcp-docs` MCP server (`.mcp.json`) serves the official MCP docs/spec. Use it when registry
  fields or behavior depend on the MCP specification, instead of guessing.

# Consistency

- Identify one reference implementation before editing. If patterns conflict, report it; don't invent a third.
- Read `documentation/decisions.md` only for decisions relevant to the task.
- Record approved architectural changes there; do not log routine edits.
- Work from a change doc in `documentation/changes/` via `/implement documentation/changes/<name>.md`.

# Verification

- Build (validates registry, typechecks, bundles to `docs/`): `npm run build` - commit the regenerated `docs/`
- Dev server: `npm run dev`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Registry validation: `npm run validate:registry`
- Reference check (skills, MCP packages, remote URLs and repos still exist; ~2s, cached 12h): `npm run check:refs` (`-- --refresh` skips the cache), also available as the `/check-refs` skill
- Lint: none yet

Before every `git push`: run `npm run check:refs` (or `/check-refs`) and do not push while it reports failed references; warnings are fine to push but mention them. Optional: `npm run setup:hooks` enables a git pre-push hook that runs the same check.

Add regression coverage for changed behavior. Report failed or skipped checks explicitly.
