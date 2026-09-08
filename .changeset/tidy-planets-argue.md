---
"@langchain/core": patch
"@langchain/openai": patch
---

Fix `AIMessage.contentBlocks` to correctly represent OpenAI responses with more than one reasoning item (e.g. a reasoning model making multiple tool calls in one turn). Reasoning blocks are now derived from `response_metadata.output` when available, with `id`/`encrypted_content` included, fixing dropped/failed replay under Zero Data Retention. `additional_kwargs.reasoning` is unchanged.
