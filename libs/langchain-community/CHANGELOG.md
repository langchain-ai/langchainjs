# @langchain/community

## 0.3.56

### Patch Changes

- 6da726f: feat(@langchain/community): add sagemaker endpoint - embedding support
- 28dd44f: chore(couchbase): Deprecate CouchbaseVectorStore and create CouchbaseSearchVectorStore
- 9adccfe: chore(@langchain/community): remove Dria retriever
- 0a640ad: feat(langchain-community): add custom schema option for neon vector store
- 940e087: fix(astra): replace deprecated 'namespace' param name
- 8ac8edd: add support for advanced metadata filters in similarity search
- e9d1136: create index aurora dsql
- e0b48fd: fix(community): improve TogetherAI error handling for chat models
- c10ea3e: allow any chars in delimited identifiers in hanavector
- 9adccfe: chore(@langchain/community): remove Dria retriever
- Updated dependencies [41bd944]
- Updated dependencies [6019a7d]
- Updated dependencies [54f542c]
- Updated dependencies [707a768]
- Updated dependencies [caf5579]
- Updated dependencies [d60f40f]
  - @langchain/openai@0.6.12
  - langchain@0.3.34
  - @langchain/weaviate@0.2.3

## 0.3.55

### Patch Changes

- f201ab8: bump firebase-admin dependency (#8861)
- f201ab8: use URL encoding for paths in github document laoder (#8860)

## 0.3.54

### Patch Changes

- 4a3f5af: Update import_constants.ts (#8747)
- 8f9c617: postgres indexes getTime returning NaN due to missing alias
- 4d26533: BM25Retriever: escape regex metacharacters in getTermFrequency to prevent crashes
- 9f491d6: milvus: Fix upsert operations when autoId is false
- 9649f20: add jira issue title to metadata for documents
- 9543ba1: add personalAccessToken to jira loader
- Updated dependencies [e0bd88c]
- Updated dependencies [4a3f5af]
- Updated dependencies [424360b]
  - langchain@0.3.32
  - @langchain/openai@0.6.10
