---
"@langchain/core": patch
---

fix(core): `AIMessageChunk.concat` now merges an id-less tool call delta into the most recent tool call that shares its `index`, so successive tool calls that reuse an `index` are no longer concatenated into the first one
