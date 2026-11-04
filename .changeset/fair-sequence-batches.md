---
"@langchain/core": patch
---

Fix RunnableSequence.batch with returnExceptions enabled so failed inputs do not reach later steps. Preserve original errors and input order, keep per-input configuration and callbacks aligned, and report failed sequence runs as errors.
