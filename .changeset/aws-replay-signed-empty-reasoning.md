---
"@langchain/aws": patch
---

Replay signed Bedrock reasoning blocks whose text is empty or missing instead of dropping them, so models that omit the thinking summary (e.g. Claude Sonnet 5, which defaults to `display: "omitted"`) no longer fail with an HTTP 400 on the turn after a tool call. A missing `text` is sent as `""`. This also applies to messages with `output_version: "v1"`. Empty reasoning without a signature is still dropped.
