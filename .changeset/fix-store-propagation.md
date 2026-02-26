---
"langchain": patch
---

fix(agents): propagate store and checkpointer in ReactAgent

- Added `checkpointer` and `store` getter/setter pairs on `ReactAgent` that forward to the internal compiled graph. This fixes an issue where the LangGraph API server's checkpointer injection was silently ignored, causing thread state to be lost across server restarts.
- Propagate `store` and `configurable` from the LangGraph config into the middleware `runtime` object. Previously, `runtime.store` was always `undefined` even when a store was provided to `createAgent()`.
