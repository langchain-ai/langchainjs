---
"@langchain/anthropic": patch
---

fix(anthropic): report refusals as `content_filter` on the native stream path

`convertAnthropicStream` now maps `stop_reason: "refusal"` to the `content_filter` finish reason instead of `stop`, so a refusal streamed through `streamEvents()` no longer looks like a normal completion.
