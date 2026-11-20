---
"@langchain/openai": patch
---

Set `normalized_finish_reason` in `response_metadata` for Chat Completions (a refusal or a forced tool call ending in `stop` maps to `refusal` / `tool_call`), and `finish_reason` (the `status`) plus `normalized_finish_reason` for the Responses API, on `invoke` and streamed results. Responses `message-finish` events carry the same fields.
