---
"@langchain/core": patch
---

`LangChainTracer` now still sends and ends a run when its trace policy's `processInputs` or `processOutputs` throws, with that payload dropped and the error set, instead of skipping the run or leaving it pending in LangSmith.
