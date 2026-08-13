---
"@langchain/anthropic": patch
---

fix(anthropic): preserve gateway cost on the native stream path

`convertAnthropicStream` now surfaces an Anthropic-compatible gateway's numeric `usage.cost` at `response_metadata.usage.cost`, matching the chunk path. Token accounting in `usage_metadata` is unchanged.
