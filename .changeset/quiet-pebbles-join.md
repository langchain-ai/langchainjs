---
"@langchain/openai": patch
---

Rebuild reasoning summaries for the Responses API without duplicating or merging parts

When an assistant message has no stored `response_metadata.output` and is
rebuilt from `additional_kwargs.reasoning`, summary parts that share a
streaming `index` are still joined, but the first part is no longer sent
twice ("First First part"), parts without an index (from non-streamed
responses) are no longer concatenated into one, and the message's own summary
parts are no longer modified, so converting the same message again gives the
same input. Messages that carry `response_metadata.output` were not affected.
