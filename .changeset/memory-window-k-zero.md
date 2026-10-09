---
"@langchain/classic": patch
---

fix(classic): `BufferWindowMemory` and `EntityMemory` with `k = 0` now keep no messages instead of the entire chat history
