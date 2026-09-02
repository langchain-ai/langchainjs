---
"@langchain/google": patch
---

Restore tool_calls → functionCall conversion in legacy path with deduplication guard.
Fixes regression from #10493 where manually constructed AIMessages with only tool_calls were silently dropped (#10502).
