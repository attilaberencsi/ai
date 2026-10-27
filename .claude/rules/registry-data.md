---
paths:
  - "registry/**"
---

# Registry data conventions

- Data is static JSON validated against a schema in `registry/`; change the schema only with approval.
- Entries must be deterministic and diff-friendly: stable key order, 2-space indent, trailing newline.
- Every entry change must pass schema validation (validator command TBD, see CLAUDE.md).
- `skills.json` follows `registry/schema/skills.schema.json`; the install source is an `owner/repo` for `npx skills add`.
- Never put secrets or credentials in registry data.
- After changing `servers.json` or `skills.json`, run `npm run check:refs`: every referenced skill, package, remote URL and repository must exist.
