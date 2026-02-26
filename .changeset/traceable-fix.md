---
"@langchain/core": patch
---

fix(core): remove inherited LangChainTracer handlers when tracingEnabled is false

When a RunTree explicitly disables tracing via `tracingEnabled: false`, `CallbackManager._configureSync` now strips any inherited `LangChainTracer` handlers so child runs don't produce traces.
