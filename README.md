# AI Library

![A software developer, half human and half cyborg, works at a desk with eight monitors; a brain-computer interface on the head is cabled to the PC](documentation/images/cyborg-developer.svg)

A curated library of **MCP servers**, **agent skills** and (soon) **agents** that I use and have validated myself.
Browse by category and install into VS Code, Cursor, Claude, Codex, Gemini CLI and more.

- **MCP Servers** - one-click or copy-paste install per client and scope (user, project, local).
- **Skills** - installed with `npx skills add`.
- **Agents** - coming soon.

The site is static and served by GitHub Pages from the `docs/` folder.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # validate data, typecheck, build into docs/
npm test
```

Data lives in `registry/` (`servers.json` follows the official MCP registry `server.json` schema; `skills.json` has its own schema).
Project notes and decisions are in `documentation/`.
