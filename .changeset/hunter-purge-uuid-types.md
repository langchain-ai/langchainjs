---
"langchain": patch
"@langchain/classic": patch
"@langchain/core": patch
"@langchain/cloudflare": patch
"@langchain/exa": patch
"@langchain/google-common": patch
"@langchain/groq": patch
"@langchain/mongodb": patch
"@langchain/neo4j": patch
"@langchain/pinecone": patch
"@langchain/qdrant": patch
"@langchain/redis": patch
"@langchain/weaviate": patch
"@langchain/xai": patch
---

chore(deps): remove redundant @types/uuid declarations

Remove `@types/uuid` from package manifests that rely on `@langchain/core/utils/uuid` or do not require uuid type stubs directly, and refresh the lockfile entries accordingly.
