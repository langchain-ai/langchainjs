---
"@langchain/core": patch
"@langchain/openai": patch
---

Fix `convertToV1FromResponses` (and therefore `AIMessage.contentBlocks`) to correctly represent OpenAI Responses API messages containing more than one reasoning item, which can happen when a reasoning model makes multiple tool calls in one turn. Previously only a single reasoning block was derived (from `additional_kwargs.reasoning`, which only ever holds one item), and it never carried `id`/`encrypted_content`, so replaying such a message under Zero Data Retention via the `v1` content-block representation could drop reasoning items or fail. This is fixed by deriving reasoning blocks from `response_metadata.output` (the original, complete, correctly-ordered response) when available, and by teaching the Responses input converter to forward `encrypted_content`. `additional_kwargs.reasoning`'s shape and construction are unchanged for every caller.
