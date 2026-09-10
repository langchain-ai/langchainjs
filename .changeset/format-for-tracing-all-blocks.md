---
"@langchain/core": patch
---

Convert every URL and base64 content block when formatting messages for tracing, not just the first. `_formatForTracing` only built its shallow copy for the first convertible block, and each copy sliced from the original `message.content`, so a message carrying two images or two files traced the first converted and the rest in their original shape.
