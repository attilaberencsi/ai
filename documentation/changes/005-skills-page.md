# Skills page
Status: done (pending manual review)

## Acceptance criteria
- [x] `registry/skills.json` holds the skills from sapdev.eu (source: attilaberencsi/sapskills) except abap-vscode-pce: clean-abap, karpathy.
- [x] Entries are validated by `npm run validate:registry` against our own `registry/schema/skills.schema.json` (modelled on SKILL.md frontmatter) plus the shared catalog block in `_meta`.
- [x] `skills.html`: same layout as the MCP page (category tabs in the URL hash, cards, alphabetical order, themes).
- [x] Install uses `npx skills add <source> --skill <name> [-a <agent>] [-g]`; one dropdown combines agent and scope (Project / Global): Choose in terminal, Claude Code, GitHub Copilot, Cursor, Codex CLI, Gemini CLI.
- [x] Card shows where the skill is installed per agent and scope, plus license, tags, notes and links.
- [x] Landing page Skills tile links to the page; header nav has a Skills link.
- [x] Shared pieces extracted: CategoryTabs.vue, clipboard composable, generic catalog helpers.
- [x] Tests for command building, targets, sorting and rendering of the cards.

## Constraints
- Agent folders per the vercel-labs/skills README (claude-code: .claude/skills; copilot/cursor/codex/gemini project: .agents/skills; global paths per agent).
- No new dependencies.

## Reference implementation
- MCP Servers page (`McpServersApp.vue`, `ServerCard.vue`).

## Remaining work
- Add more skills as they get validated; check the agent folder table against `npx skills add --help` when the CLI changes.
