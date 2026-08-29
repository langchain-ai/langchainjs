---
"@langchain/pinecone": patch
---

fix(pinecone): return early from `addVectors` when given an empty array

Guard `addVectors` with an early `return []` when `vectors.length === 0` to
prevent a "Must pass in at least 1 record to upsert." error that the
`@pinecone-database/pinecone` SDK throws when `upsert` is called with no
records. This makes `addDocuments([])` and `addVectors([], [])` safe no-ops
instead of throwing, which can happen when a document splitter produces zero
chunks or when all documents are filtered out before embedding.
