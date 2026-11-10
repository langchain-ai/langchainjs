---
"create-langchain-integration": patch
---

Import `Command` by name from commander, since commander 15 is ESM-only and
has no default export. Also drop the check for a `--reset-preferences` option
the CLI never defined.
