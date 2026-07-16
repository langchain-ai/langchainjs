---
"@langchain/anthropic": patch
---

fix(anthropic): honor cumulative `message_delta.usage` fields (input_tokens, cache_creation_input_tokens, cache_read_input_tokens) in streaming usage metadata. Anthropic-compatible gateways backed by OpenAI-style upstreams (LiteLLM, Bedrock proxies) can only report usage at stream end via `message_delta`; previously those fields were discarded and streamed `usage_metadata` reported `input_tokens: 0` with no cache details.
