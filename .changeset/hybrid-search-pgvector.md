---
"@langchain/pgvector": minor
---

Added hybrid search to PGVectorStore, combining vector similarity with Postgres full-text search via reciprocal rank fusion. New `hybridSearch` / `hybridSearchWithScore` methods run both branches and the fusion in a single SQL round trip, honoring metadata filters and collections in both branches, and `createHybridSearchIndex` creates the GIN expression index for the full-text branch so it works on existing tables without schema changes.
