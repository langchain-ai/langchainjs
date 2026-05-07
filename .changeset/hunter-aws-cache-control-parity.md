---
"@langchain/aws": patch
---

fix(aws): align Bedrock prompt caching with Python behavior

Add `cache_control` request handling for `ChatBedrockConverse` so cache points
are applied at request time, and align Bedrock usage accounting by including
cache read/write input tokens in `usage_metadata.input_tokens`.
