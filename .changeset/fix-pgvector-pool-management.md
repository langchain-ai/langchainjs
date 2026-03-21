---
"@langchain/community": patch
---

fix(community): PGVectorStore no longer leaks a pool client on init or terminates externally-provided pools on end()
