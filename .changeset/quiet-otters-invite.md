---
"@langchain/openai": patch
---

Map OpenAI's `cache_write_tokens` to `cache_creation` in `usage_metadata.input_token_details`, mirroring the existing `cached_tokens` -> `cache_read` mapping across the Chat Completions and Responses APIs. Previously, prompt cache-write token counts were silently dropped.
