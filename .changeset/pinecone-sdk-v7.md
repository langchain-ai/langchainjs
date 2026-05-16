---
"@langchain/pinecone": minor
---

fix(pinecone): support Pinecone JS SDK v7 upsert/deleteMany APIs

Align `@langchain/pinecone` with `@pinecone-database/pinecone` v7 option-object APIs for `upsert` and `deleteMany`, and construct `Index` via v7 `IndexOptions` when using `pineconeConfig`.

**BREAKING CHANGE**: The `@pinecone-database/pinecone` peer dependency now requires v7 (`^7.0.0`). Upgrade from v5/v6 before updating `@langchain/pinecone`.

Fixes #10890
