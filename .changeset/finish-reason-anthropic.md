---
"@langchain/anthropic": patch
---

Emit raw `finishReason`, `normalizedFinishReason` and `finishState` on `message-finish`. `refusal` and `model_context_window_exceeded` map to `refusal` and `context_exceeded`, and `pause_turn` sets `finishState: "suspended"`.
