---
"langchain": patch
---

Add `tracePolicy` to `createMiddleware`, applied to the middleware's lifecycle hook runs. It only changes what `LangChainTracer` sends to LangSmith (use `omitPayload` from `@langchain/core/tracers/tracer_langchain`). Requires `@langchain/langgraph` >= 1.6.1.
