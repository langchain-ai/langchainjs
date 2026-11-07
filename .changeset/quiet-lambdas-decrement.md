---
"@langchain/core": patch
---

Only decrement `recursionLimit` when a `RunnableLambda` actually invokes a runnable it returns, so wrapped functions now see the caller's limit instead of one less. Matches the Python implementation.
