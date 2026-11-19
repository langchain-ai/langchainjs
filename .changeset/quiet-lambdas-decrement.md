---
"@langchain/core": patch
---

Only decrement `recursionLimit` when a `RunnableLambda` actually invokes a runnable it returns, so wrapped functions now see the caller's limit instead of one less. Matches the Python implementation.

This also means a lambda that recursively invokes itself through the implicit config context, without passing `config` explicitly, no longer counts down to `Recursion limit reached.` Pass the config to recursive calls when they should consume the recursion budget.
