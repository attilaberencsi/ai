---
name: check-refs
description: Verify that every skill, MCP server package, remote endpoint and repository referenced by registry/servers.json and registry/skills.json still exists. Run it before every git push, and after adding or changing registry entries.
---

Check that everything the registry points to is still there. It is quick (about 40 references in a couple of
seconds, cached for 12 hours) and needs no extra tools.

1. Run `npm run check:refs`. Add `-- --refresh` to ignore the cache (use it when something was just published or removed).
2. Read the result:
   - `✘` failed: the reference is gone or wrong (missing skill, wrong branch, unknown npm/PyPI package, pinned version that
     does not exist, dead remote URL, missing repository). Fix the entry in `registry/servers.json` or `registry/skills.json`,
     or ask the user whether to remove it. Never push while there are failures.
   - `⚠` warning: usually a server error or a skill whose upstream description changed. Mention it; update the description
     in the registry if it changed upstream.
   - exit code 2: the network was not reachable, so nothing was verified. Say so instead of claiming success.
3. After changing registry data, run `npm run build` (it also validates the data) and commit the regenerated `docs/`.
4. Report briefly: how many references were checked, and any failures or warnings with the fix applied or proposed.

What it checks: skills (SKILL.md exists at the right repository, branch and path, and its `name` matches), npm and PyPI
packages (and pinned versions), public remote MCP URLs (answers other than "gone"), and GitHub repositories.
Not checked: `localhost` URLs and OCI/mcpb packages (reported as skipped).
