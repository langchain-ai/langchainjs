---
"@langchain/anthropic": patch
---

fix(anthropic): preserve context management on the native stream path

`convertAnthropicStream` now includes Anthropic `context_management` details in the final message's `response_metadata`, matching the legacy chunk path.
