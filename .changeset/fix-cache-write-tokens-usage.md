---
"@langchain/core": patch
---

Fix `cache_write_tokens` being dropped from usage metadata when streaming through OpenAI-compatible gateways that report cache write counts in `prompt_tokens_details` instead of the Anthropic-style field.
