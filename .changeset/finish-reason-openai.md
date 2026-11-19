---
"@langchain/openai": patch
---

Emit raw `finishReason`, `normalizedFinishReason` and `finishState` on Responses API `message-finish` events, using `status` and `incomplete_details`. Refusal output normalizes to `refusal`, and `failed` to `error`.
