---
"@langchain/core": patch
---

feat(core): add uuid v6 utility support

Add `v6` UUID generation support to `@langchain/core/utils/uuid` by vendoring the upstream uuidjs `v6` implementation and its `v1ToV6` helper, exporting `v6` from the UUID utils index, and adding tests for deterministic generation, buffer/offset behavior, validation/versioning, and ordering.
