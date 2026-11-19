---
"@langchain/core": minor
---

Standardize finish reason on `message-finish` events and final `AIMessage`s, streamed or from `invoke`. Events now carry `finishReason` (raw provider value), `normalizedFinishReason` (`stop | length | tool_call | content_filter | refusal | context_exceeded | error | other`) and `finishState` (`complete | suspended`, Anthropic only), and `response_metadata` gets `finish_reason` (raw), `normalized_finish_reason` and, for Anthropic, `finish_state`. Unmapped provider values normalize to `other` instead of `stop`. The `reason` field is deprecated but still emitted with its old values (`refusal` and `context_exceeded` map back to `content_filter` and `length`; left unset for `other` and `error`), and `response_metadata.finish_reason` on streamed messages now holds the raw provider value instead of the normalized one.
