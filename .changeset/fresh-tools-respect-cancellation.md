---
"@langchain/core": patch
---

Reject pre-aborted structured `tool()` calls before starting the user handler, preserving the signal's cancellation reason instead of leaving the call pending.
