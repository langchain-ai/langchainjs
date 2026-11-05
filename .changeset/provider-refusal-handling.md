---
"@langchain/openai": patch
"@langchain/anthropic": patch
"@langchain/google": patch
"@langchain/google-genai": patch
"@langchain/google-common": patch
---

fix(providers): surface model refusals as `ModelRefusalError`

- OpenAI: Chat Completions keeps `refusal` from responses and stream deltas, refusal blocks are sent back natively, and `withStructuredOutput` with `jsonSchema` throws `ModelRefusalError` on a refusal.
- Anthropic: a `refusal` stop reason maps to the `content_filter` finish reason in stream events, and `withStructuredOutput` throws `ModelRefusalError` on a refusal, including when thinking is enabled.
- Google: errors for blocked prompts and safety stops also match `ModelRefusalError.isInstance`, and refusal blocks are dropped when history is sent back.
