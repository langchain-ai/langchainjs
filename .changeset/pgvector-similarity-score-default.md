---
"@langchain/pgvector": minor
---

**Breaking change:** `PGVectorStore.similaritySearchWithScore` now returns normalized similarity scores (1 = exact match, 0 = no similarity) instead of raw pgvector distance values (0 = exact match).

The `scoreNormalization` option now defaults to `"similarity"` instead of `"distance"`. To restore the previous behavior, pass `scoreNormalization: "distance"` in the constructor options.

For cosine distance (the default), similarity is computed as `(2 - distance) / 2`, mapping the full pgvector range [0, 2] to [1, 0]. This is consistent with other vector store implementations in LangChain.js where higher scores mean more similar.
