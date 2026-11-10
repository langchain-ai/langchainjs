---
"@langchain/anthropic": patch
---

fix(anthropic): surface model refusals as `ModelRefusalError`

A `refusal` stop reason maps to the `content_filter` finish reason in stream events, and `withStructuredOutput` throws `ModelRefusalError` on a refusal, including when thinking is enabled.
