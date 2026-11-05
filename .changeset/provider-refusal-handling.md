---
"@langchain/openai": patch
"@langchain/anthropic": patch
"@langchain/google": patch
"@langchain/google-genai": patch
"@langchain/google-common": patch
---

fix(providers): surface model refusals as `ModelRefusalError`

- OpenAI: Chat Completions keeps `refusal` from responses and stream deltas, refusals are sent back natively on assistant messages (including `v1` messages), and `withStructuredOutput` with `jsonSchema` throws `ModelRefusalError` on a refusal.
- Anthropic: a `refusal` stop reason maps to the `content_filter` finish reason in stream events, and `withStructuredOutput` throws `ModelRefusalError` on a refusal, including when thinking is enabled.
- Google: errors for blocked prompts and safety stops also match `ModelRefusalError.isInstance`, including when streaming. A streamed safety stop in `@langchain/google-genai` keeps the text already streamed and ends with a refusal block. The `@langchain/google-genai` tool-calling structured output parser throws `ModelRefusalError` on a refusal, and refusal blocks are dropped when history is sent back.
