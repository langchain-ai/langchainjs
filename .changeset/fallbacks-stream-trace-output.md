---
"@langchain/core": patch
---

`RunnableWithFallbacks.stream()` now reports the aggregated stream output when its run ends. It previously always reported an empty output, so traces of streamed fallback runs showed no result.
