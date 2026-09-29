---
"@langchain/core": patch
---

Widen `OpenAICompletionsToolCallDelta.type` from `"function"` to
`"function" | "custom"` to match the OpenAI SDK's `ChatCompletionChunk`, so
provider adapters can pass SDK chunks through without narrowing them first.
Type-only; no runtime change. Custom tool calls are still not converted into
named tool calls.
