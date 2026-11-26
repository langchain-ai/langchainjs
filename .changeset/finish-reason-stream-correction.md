---
"@langchain/core": patch
---

Apply the finish-reason corrections on `stream()`. The chunk that carries `normalized_finish_reason` usually holds none of the tool calls or the refusal, so a forced `tool_choice` (raw `stop` plus tool calls) and a refusal reported before the finish chunk came back as `stop` from `stream()` while `invoke()` and `streamEvents()` already reported `tool_call` and `refusal`.
