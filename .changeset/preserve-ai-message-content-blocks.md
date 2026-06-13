---
"@langchain/core": patch
---

fix(core): preserve AIMessage content blocks

Keep existing v1 contentBlocks when constructing AIMessage instances so serialized messages do not lose block content during deserialization.
