---
"@langchain/core": patch
"@langchain/openai": patch
---

Fix OpenAI Responses API replay under Zero Data Retention when a response contains more than one reasoning item, for both v0 and v1. In v0, the default replay path now reuses `response_metadata.output` directly, preserving every reasoning item's `id`/`encrypted_content` in original order. In v1, `AIMessage.contentBlocks` (`outputVersion: "v1"`) is fixed the same way. `additional_kwargs.reasoning` is unchanged.
