---
"@langchain/core": patch
---

refactor(core): decouple tracer-only metadata defaults from runnable metadata

- Add tracer-scoped inheritable metadata/tag options in callback manager while keeping backward-compatible aliases.
- Move configurable-to-tracing metadata derivation into a tracer-only path and keep `ensureConfig` metadata mirroring limited to `model`.
- Update `LangChainTracer` default metadata/tag handling and add regression tests for stream events metadata behavior.
