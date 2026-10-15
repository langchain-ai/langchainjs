---
"@langchain/core": patch
---

fix(core): messages returned with `outputVersion: "v1"` no longer nest `lc_kwargs` inside their serialized form, so `toJSON()` stops repeating the message content at every level.
