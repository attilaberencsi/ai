# Install scopes
Status: done (pending manual review)

## Acceptance criteria
- [x] Each server card has a Scope selector: User (all projects), Project (shared in repo), Local (this project, private).
- [x] Scope-aware output per client; unsupported scopes are disabled for that client and fall back (shown in the card).
- [x] Claude Code: local (default, no flag) / project (`--scope project` -> .mcp.json) / user (`--scope user`).
- [x] VS Code (+Insiders): user -> deep link / `--add-mcp`; project -> `.vscode/mcp.json` snippet.
- [x] Cursor: user -> deep link; project -> `.cursor/mcp.json` snippet.
- [x] Gemini CLI: explicit `--scope user|project` (CLI default is project).
- [x] Codex: user -> `codex mcp add`; project -> TOML for `.codex/config.toml`.
- [x] Claude connector and Claude Desktop: single (account/user) scope.
- [x] Project scope warns not to commit real secrets; each card shows where the server is installed.
- [x] Unit tests for all scope paths.

## Constraints
- Commands come from official docs where available (Claude Code scopes verified at code.claude.com/docs/en/mcp).
- Unverified: Gemini/Codex flag details (third-party sources), Cursor deep link always installs globally, `.codex/config.toml` project TOML.

## Reference implementation
- `src/lib/install.ts` (`installOptions`).

## Remaining work
- Manually check the VS Code workspace and Codex project snippets in the real tools.
