---
"@langchain/aws": patch
---

Replay signed Bedrock reasoning blocks whose text is empty instead of dropping them, so models that omit the thinking summary (e.g. Claude Sonnet 5, which defaults to `display: "omitted"`) no longer fail with an HTTP 400 on the turn after a tool call. Empty reasoning without a signature is still dropped.
