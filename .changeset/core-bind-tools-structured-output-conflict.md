---
"@langchain/core": patch
---

Throw a descriptive error when `withStructuredOutput` is called on a model that already has tools bound via `bindTools`. Introduces `ChatModelRunnableBinding` which also exposes `getTools()` for inspecting bound tools.
