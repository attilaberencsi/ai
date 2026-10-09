---
name: implement
description: Implement a focused change using existing project patterns.
disable-model-invocation: true
---

Task: $ARGUMENTS

1. Read the named change document, if supplied.
2. Inspect only relevant code and identify a reference implementation.
3. State a short plan. Ask before changing architecture, dependencies,
   the data schema, or public contracts; otherwise proceed.
4. Implement the smallest coherent change using existing patterns.
5. Add or update tests and run the relevant verification commands.
6. Review the diff against acceptance criteria and applicable rules.
7. Update the change checklist. Record only approved durable decisions in documentation/decisions.md.
8. Summarize changes, verification results, and remaining issues briefly.

Do not create extra planning documents or delegate to subagents unless
the task genuinely requires it.
