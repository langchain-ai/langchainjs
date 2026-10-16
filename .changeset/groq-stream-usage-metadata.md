---
"@langchain/groq": patch
---

Populate `usage_metadata` on streamed `AIMessageChunk`s from the `x_groq.usage` field, so `model.stream()` reports token usage the same way `invoke()` does.
