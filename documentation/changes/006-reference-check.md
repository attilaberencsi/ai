# Reference check before push
Status: done (pending manual review)

## Acceptance criteria
- [x] `npm run check:refs` verifies that everything the registry refers to still exists: skills (SKILL.md at the right repo, branch and path, name matches), npm and PyPI packages and pinned versions, public remote MCP URLs, GitHub repositories.
- [x] Efficient: one small request per unique reference, 10 in parallel, 10 s timeout, successful results cached 12 h in `.cache/` (git-ignored); about 40 references take 1-2 s uncached.
- [x] Exit codes: 0 fine (warnings allowed), 1 something is gone or wrong, 2 network unreachable.
- [x] Local URLs (localhost, private ranges) and OCI/mcpb packages are skipped and reported.
- [x] `/check-refs` Claude skill, a rule in CLAUDE.md to run it before every push, and an opt-in git pre-push hook (`npm run setup:hooks`).
- [x] Unit tests for the pure parts (URL building, frontmatter, status judging, de-duplication).

## Constraints
- No new dependencies (built-in fetch).
- Skills on a branch use `ref` in skills.json and `owner/repo#ref` in the install command (verified with `npx skills add capire/skills#devtoberfest --list`).

## Reference implementation
- `scripts/check-refs.ts`, `scripts/refs-lib.ts`.

## Remaining work
- Skills moved from the devtoberfest branch to main: drop their `ref` (the check will flag them once the branch is deleted).
