---
"@langchain/core": minor
"@langchain/anthropic": patch
"@langchain/openai": patch
"@langchain/google": patch
"@langchain/google-genai": patch
"@langchain/google-common": patch
"@langchain/aws": patch
"@langchain/ollama": patch
"@langchain/cohere": patch
"@langchain/cloudflare": patch
---

Standardize finish reason on `message-finish` events and streamed `AIMessage`s. Events now carry `finishReason` (raw provider value), `normalizedFinishReason` (`stop | length | tool_call | content_filter | error | other`) and `finishState` (`complete | suspended`), and `response_metadata` gets `finish_reason` (raw), `normalized_finish_reason` and `finish_state`. Unmapped provider values normalize to `other` instead of `stop`. The `reason` field is deprecated but still emitted with its old values (left unset for `other` and `error`), and `response_metadata.finish_reason` on streamed messages now holds the raw provider value instead of the normalized one.
