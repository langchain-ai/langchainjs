---
"@langchain/core": patch
---

fix(core): read `retry-after-ms` and exhausted rate-limit reset headers on 429s, and stop misreading malformed or asctime `Retry-After` values
