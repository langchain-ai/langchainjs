---
"@langchain/core": patch
---

Preserve failed fetch responses on AsyncCaller errors so HTTP status and Retry-After headers reach the existing retry classifier.
