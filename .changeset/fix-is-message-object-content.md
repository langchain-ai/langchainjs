---
"@langchain/core": patch
---

Allow plain objects as message content in `isMessage()` type guard.
Fixes ToolMessage with arbitrary object content being silently dropped by provider converters (#10500).
