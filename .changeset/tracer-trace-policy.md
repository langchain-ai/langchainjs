---
"@langchain/core": minor
---

Add `tracePolicy` to `RunnableSequence`. Its `processInputs`/`processOutputs` shape only what `LangChainTracer` sends to LangSmith for the sequence's own run. Batched sequence runs now each record their own output.
