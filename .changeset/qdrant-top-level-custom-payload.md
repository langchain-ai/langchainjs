---
"@langchain/qdrant": minor
---

Add the `customPayloadAtTopLevel` option to `QdrantVectorStore` so custom fields can be stored and filtered at the top level of a point's payload. Custom fields stay nested under `customPayload` by default.
