---
"@langchain/core": patch
---

Restore standard SHA-256 compression rounds. Digest-derived default cache keys change, so existing entries need regeneration.
