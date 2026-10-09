---
paths:
  - "registry/**"
---

# Registry data conventions

- Data is static JSON validated against a schema in `registry/`; change the schema only with approval.
- Entries must be deterministic and diff-friendly: stable key order, 2-space indent, trailing newline.
- Every entry change must pass schema validation (validator command TBD, see CLAUDE.md).
- Never put secrets or credentials in registry data.
