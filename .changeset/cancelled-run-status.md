---
"@langchain/core": minor
---

feat(core): trace deliberate cancels as `cancelled` and LangGraph interrupts as `interrupted`

Aborting a run with the new `ExpectedCancellation` as the reason makes `LangChainTracer` send an explicit run `status` of `cancelled`; `GraphInterrupt`-family errors send `interrupted`. Unmarked aborts, timeouts and other errors stay `error`. Takes effect with a `langsmith` client that forwards `status`; older clients ignore it.
