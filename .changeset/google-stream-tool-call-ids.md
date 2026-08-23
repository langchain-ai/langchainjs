---
"@langchain/google": patch
---

Carry tool-call IDs through native Gemini stream events. The `functionCall` branch of `convertGoogleGeminiStream` never set an `id` on the block accumulator, `content-block-start` or `content-block-delta`, so `finalizeContentBlock` produced a `tool_call` block with `id: undefined` and a later `ToolMessage.tool_call_id` had nothing to match. A server-assigned `functionCall.id` is now preserved, and when Gemini omits one the same `lc-tool-call-*` fallback the non-streaming converter uses is generated — one stable id from block start through finalization.
