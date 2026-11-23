---
"@langchain/core": patch
---

Fix cumulative output parsers rejecting messages with content block arrays while streaming. JSON parsing now uses the same text extraction as `invoke()`, and tool-call parsers retain the original message metadata when accumulating chunks.
