---
"@langchain/aws": patch
---

Set `finish_reason` (the `stopReason`) and `normalized_finish_reason` in `response_metadata` on `ChatBedrockConverse` `invoke` and streamed results, and emit them on `message-finish`. `malformed_model_output` and `malformed_tool_use` normalize to `error`; unmapped stop reasons to `other`.
