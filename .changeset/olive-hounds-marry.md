---
"@langchain/tavily": patch
"@langchain/ibm": patch
"@langchain/mistralai": patch
---

Fix type errors surfaced by typechecking

- `@langchain/tavily`: the published type declarations imported
  `InferInteropZodOutput` from `@langchain/core/dist/utils/types/zod.js`, a
  path `@langchain/core` does not export, so the type could not be resolved.
  It now comes from the public `@langchain/core/utils/types`.
- `@langchain/ibm` and `@langchain/mistralai` set `object` and `created` on
  their OpenAI-shaped stream chunks. Neither field exists on
  `OpenAICompletionsStreamChunk`, and nothing reads them, so both are removed.
