---
"@langchain/core": patch
"@langchain/fireworks": patch
"@langchain/together-ai": patch
---

Align OpenAI-compatible types with the current OpenAI SDK

- `@langchain/core`: widen `OpenAICompletionsToolCallDelta.type` from
  `"function"` to `"function" | "custom"`, matching the SDK's
  `ChatCompletionChunk`. Provider adapters could not pass SDK chunks through
  without narrowing them first. The converter never reads `.type` — tool call
  chunks are built from `id`, `index` and `function` — so this is a type-only
  widening of an input type with no runtime change.
- `@langchain/fireworks`, `@langchain/together-ai`: `configuration` moved from
  `OpenAIChatInput` to `BaseChatOpenAIFields` in `@langchain/openai`, so these
  input interfaces silently lost the field while their constructors still read
  `fields.configuration`. Now picked up from the interface that owns it.
