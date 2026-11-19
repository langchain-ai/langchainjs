---
"@langchain/anthropic": patch
---

Set `finish_reason` (the `stop_reason`), `normalized_finish_reason` and `finish_state` in `response_metadata` on `invoke` and streamed results, and emit them on `message-finish`. `refusal` and `model_context_window_exceeded` map to `refusal` and `context_exceeded`, and `pause_turn` sets `finish_state: "suspended"`.
