---
"@langchain/core": patch
---

feat(core): add a standard `refusal` content block and `ModelRefusalError`

Model refusals from OpenAI, Anthropic, and Gemini now appear as a `refusal` content block in `message.contentBlocks`. JSON, tool-call, and structured output parsers throw `ModelRefusalError` (from `@langchain/core/errors`) when the model refuses, instead of a generic parsing error. `ModelRefusalError.markAsRefusal` lets provider errors for refusals also match `ModelRefusalError.isInstance`.
