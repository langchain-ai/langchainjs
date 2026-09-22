---
"@langchain/cloudflare": patch
"@langchain/mistralai": patch
"@langchain/tavily": patch
"@langchain/ibm": patch
---

Fix broken imports and type errors surfaced by typechecking

- `@langchain/tavily` imported `InferInteropZodOutput` from
  `@langchain/core/dist/utils/types/zod.js`, a deep path into `dist` that is not
  an export. Now uses the public `@langchain/core/utils/types`.
- `@langchain/cloudflare` imported `ContentBlock` from
  `@langchain/core/messages/content`, a subpath that does not exist. Now uses
  `@langchain/core/messages`.
- `@langchain/ibm` and `@langchain/mistralai` set `object` and `created` on their
  OpenAI-shaped stream chunks. Neither field exists on
  `OpenAICompletionsStreamChunk` and the consumer cannot read undeclared fields,
  so both were inert and are removed.
