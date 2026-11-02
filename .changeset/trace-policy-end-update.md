---
"@langchain/core": patch
---

`LangChainTracer` now still ends a run when its trace policy's `processOutputs` throws, sending the end update with outputs dropped and the error set, instead of leaving the run pending in LangSmith.
