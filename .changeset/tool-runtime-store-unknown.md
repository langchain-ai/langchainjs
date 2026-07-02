---
"@langchain/core": patch
---

Type `ToolRuntime.store` as `unknown` so it reflects the shape actually injected at runtime (e.g. LangGraph's `BaseStore`, which uses `get`/`put`) instead of the unrelated `mget`/`mset` `BaseStore` from `@langchain/core/stores`. Callers should narrow to the store type provided by their runtime.
