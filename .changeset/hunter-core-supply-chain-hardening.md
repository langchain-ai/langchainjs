---
"@langchain/core": patch
---

chore(core): reduce transitive dependency exposure and tighten release hygiene

Remove direct runtime dependencies on `ansi-styles`, `camelcase`, and `decamelize`
by inlining equivalent logic in core internals, and enable npm provenance in the
release workflow.
