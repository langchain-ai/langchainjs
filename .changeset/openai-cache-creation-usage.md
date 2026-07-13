---
"@langchain/openai": patch
---

fix(openai): surface prompt-cache write tokens in usage_metadata. LiteLLM-based gateways and Anthropic-style providers report cache writes as `prompt_tokens_details.cache_creation_tokens` or top-level `cache_creation_input_tokens`; these are now mapped to `usage_metadata.input_token_details.cache_creation` in both the invoke and streaming paths.
