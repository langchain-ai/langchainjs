---
"@langchain/mongodb": minor
---

feat(mongodb): add `$rerank` aggregation pipeline support to `MongoDBAtlasVectorSearch`

Adds an optional `rerankOptions` constructor parameter that appends a `$rerank` stage after `$vectorSearch` to reorder results by semantic relevance using a MongoDB Atlas reranking model. The rerank score is returned as the numeric score in the `[Document, number]` tuple and copied to `document.metadata.relevanceScore`.
