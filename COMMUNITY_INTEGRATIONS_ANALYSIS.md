# Community Integrations: Candidates for Separation into Own Packages

This document identifies integrations currently in `@langchain/community` that are worth porting
into their own standalone `@langchain/<provider>` packages, based on three criteria:

1. **Well-written tests** — both unit tests (`.test.ts`) and integration tests (`.int.test.ts`), ideally standard tests too
2. **Substance** — more than a single source file; spans multiple categories (chat_models, embeddings, vectorstores, etc.) or uses a multi-file directory structure
3. **Known provider** — from a recognized, established vendor

## Already extracted providers (for reference)

These providers already have their own `@langchain/*` packages under `libs/providers/` and should
**not** be ported again:

- `@langchain/anthropic`, `@langchain/aws` (Bedrock chat + embeddings), `@langchain/cloudflare`,
  `@langchain/deepseek`, `@langchain/google-*` (GenAI, Vertex, etc.), `@langchain/groq`,
  `@langchain/mistralai`, `@langchain/mongodb`, `@langchain/ollama`, `@langchain/openai`,
  `@langchain/openrouter`, `@langchain/redis`, `@langchain/turbopuffer`, `@langchain/xai`

---

## Tier 1: Strong Candidates (multi-category, excellent tests)

### 1. IBM (watsonx)

**Recommended package name:** `@langchain/ibm`

| Category | Source Files | Lines |
|---|---|---|
| Chat Models | `chat_models/ibm.ts` | 1,311 |
| LLMs | `llms/ibm.ts` | 797 |
| Embeddings | `embeddings/ibm.ts` | 287 |
| Document Compressors | `document_compressors/ibm.ts` | 178 |
| Agent Toolkits | `agents/toolkits/ibm.ts` | 151 |
| Utils | `utils/ibm.ts` | 370 |
| Types | `types/ibm.ts` | 82 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `chat_models/tests/ibm.test.ts` | 990 | Unit |
| `chat_models/tests/ibm.int.test.ts` | 1,034 | Integration |
| `chat_models/tests/ibm.standard.test.ts` | 56 | Standard |
| `chat_models/tests/ibm.standard.int.test.ts` | 51 | Standard Int |
| `llms/tests/ibm.test.ts` | 563 | Unit |
| `llms/tests/ibm.int.test.ts` | 524 | Integration |
| `embeddings/tests/ibm.test.ts` | 276 | Unit |
| `embeddings/tests/ibm.int.test.ts` | 85 | Integration |
| `document_compressors/tests/ibm.test.ts` | 159 | Unit |
| `document_compressors/tests/ibm.int.test.ts` | 116 | Integration |
| `agents/toolkits/tests/ibm.test.ts` | 85 | Unit |
| `agents/toolkits/tests/ibm.int.test.ts` | 206 | Integration |
| `utils/tests/ibm.test.ts` | 33 | Unit |

**Total:** ~3,176 lines source + ~4,178 lines tests = **~7,354 lines across 20 files**

**Assessment:** The strongest candidate by far. Covers 5 integration surfaces (chat, LLM, embeddings,
compressors, agent toolkit) with dedicated unit + integration tests for every single one, plus
standard tests for chat models. Well-structured with shared utils and types.

---

### 2. Alibaba Tongyi (DashScope / Qwen)

**Recommended package name:** `@langchain/alibaba`

| Category | Source Files | Lines |
|---|---|---|
| Chat Models | `chat_models/alibaba_tongyi.ts` | 1,412 |
| Embeddings | `embeddings/alibaba_tongyi.ts` | 204 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `chat_models/tests/chatalitongyi.test.ts` | 1,417 | Unit |
| `chat_models/tests/chatalitongyi.int.test.ts` | 295 | Integration |
| `chat_models/tests/chatalitongyi.standard.int.test.ts` | 58 | Standard Int |

**Total:** ~1,616 lines source + ~1,770 lines tests = **~3,386 lines across 5 files**

**Assessment:** Very strong chat model implementation (1,412 lines) with exceptionally thorough unit
tests (1,417 lines). Has unit + integration + standard tests for chat. Embeddings lack dedicated tests
but the chat model quality is outstanding.

---

### 3. Tencent Hunyuan

**Recommended package name:** `@langchain/tencent-hunyuan`

| Category | Source Files | Lines |
|---|---|---|
| Chat Models | `chat_models/tencent_hunyuan/{base,index,web}.ts` | 639 |
| Embeddings | `embeddings/tencent_hunyuan/{base,index,web}.ts` | 225 |
| Utils | `utils/tencent_hunyuan/{common,index,web}.ts` | 117 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `chat_models/tests/chattencenthunyuan.int.test.ts` | — | Integration |
| `embeddings/tests/tencent_hunyuan.test.ts` | — | Unit |

**Total:** ~981 lines source across 9 files, multi-environment builds (Node + Web)

**Assessment:** Multi-file directory structure with Node/Web split pattern (similar to how Bedrock
is structured). Covers chat + embeddings + utils. Tests are split (chat int-only, embeddings unit-only)
which is a weakness, but the codebase structure is solid and follows good patterns.

---

## Tier 2: Good Candidates (multi-category or multi-file, good tests)

### 4. Neo4j

**Recommended package name:** `@langchain/neo4j`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/neo4j_vector.ts` | 1,147 |
| Graph Database | `graphs/neo4j_graph.ts` | 746 |
| Message Store | `stores/message/neo4j.ts` | 165 |
| Graph QA Chain | `chains/graph_qa/cypher.ts` + `prompts.ts` | 263 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/neo4j_vector.int.test.ts` | 720 | Integration |
| `vectorstores/tests/neo4j_vector.fixtures.ts` | 115 | Fixtures |
| `graphs/tests/neo4j_graph.int.test.ts` | 273 | Integration |
| `stores/tests/neo4j.int.test.ts` | 138 | Integration |
| `chains/graph_qa/tests/cypher.int.test.ts` | 124 | Integration |

**Total:** ~2,321 lines source + ~1,370 lines tests = **~3,691 lines across 10 files**

**Assessment:** Substantial multi-category integration spanning vector store, graph database, message
store, and graph QA chains. Tests are integration-only (requires Neo4j) but thorough. One of the
largest community integrations by total code volume. The Cypher chain + prompts component adds
unique value.

---

### 5. Cassandra

**Recommended package name:** `@langchain/cassandra`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/cassandra.ts` | 466 |
| Utils | `utils/cassandra.ts` | 1,233 |
| Storage | `storage/cassandra.ts` | 291 |
| Message Store | `stores/message/cassandra.ts` | 151 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/cassandra.int.test.ts` | 502 | Integration |
| `storage/tests/cassandra.int.test.ts` | 105 | Integration |
| `stores/tests/cassandra.int.test.ts` | 112 | Integration |

**Total:** ~2,141 lines source + ~719 lines tests = **~2,860 lines across 7 files**

**Assessment:** Large shared utility module (1,233 lines) indicates deep integration. Covers 4
categories. Tests are integration-only but exist for vector store, storage, and message store.

---

### 6. Supabase

**Recommended package name:** `@langchain/supabase`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/supabase.ts` | 442 |
| Retriever | `retrievers/supabase.ts` | 241 |
| Structured Query | `structured_query/supabase.ts` + `supabase_utils.ts` | 615 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/supabase.test.ts` | 45 | Unit |
| `vectorstores/tests/supabase.int.test.ts` | 415 | Integration |
| `retrievers/tests/supabase.int.test.ts` | 25 | Integration |
| `structured_query/tests/supabase_self_query.int.test.ts` | 705 | Integration |

**Total:** ~1,298 lines source + ~1,190 lines tests = **~2,488 lines across 8 files**

**Assessment:** Spans vector store, retriever, and structured query — a coherent data layer. Has both
unit and integration tests for the vector store. The structured query / self-query integration is
the most substantial at 705 lines.

---

### 7. Milvus

**Recommended package name:** `@langchain/milvus`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/milvus.ts` | 880 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/milvus.test.ts` | 492 | Unit |
| `vectorstores/tests/milvus.int.test.ts` | 237 | Integration |
| `indexes/tests/indexing.milvus.int.test.ts` | 440 | Integration |

**Total:** ~880 lines source + ~1,169 lines tests = **~2,049 lines across 4 files**

**Assessment:** While single-category (vectorstore), it has excellent test coverage with both unit
and integration tests, plus separate indexing integration tests. Known, widely-used vector database.

---

### 8. Chroma

**Recommended package name:** `@langchain/chroma`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/chroma.ts` | 511 |
| Structured Query | `structured_query/chroma.ts` | 147 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/chroma.test.ts` | 154 | Unit |
| `vectorstores/tests/chroma.int.test.ts` | 161 | Integration |
| `structured_query/tests/chroma_self_query.int.test.ts` | 110 | Integration |

**Total:** ~658 lines source + ~425 lines tests = **~1,083 lines across 5 files**

**Assessment:** Multi-file with vector store + structured query. Has both unit and integration tests
for the core vector store. Well-established open-source vector database.

---

### 9. FAISS

**Recommended package name:** `@langchain/faiss`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/faiss.ts` | 469 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/faiss.test.ts` | 344 | Unit |
| `vectorstores/tests/faiss.int.test.ts` | 196 | Integration |

**Total:** ~469 lines source + ~540 lines tests = **~1,009 lines across 3+ files**

**Assessment:** Has excellent test-to-code ratio with both unit and integration tests. FAISS is
a widely-used Meta vector search library. Also has a Python test data directory for cross-language
compatibility testing.

---

### 10. pgvector

**Recommended package name:** `@langchain/pgvector`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/pgvector.ts` | 1,228 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/pgvector/pgvector.int.test.ts` | 1,094 | Integration |
| `vectorstores/tests/pgvector_score_normalization.test.ts` | 372 | Unit |
| `vectorstores/tests/pgvector_similarity_score.test.ts` | 360 | Unit |
| `vectorstores/tests/pgvector_similarity_score.unit.test.ts` | 186 | Unit |

**Total:** ~1,228 lines source + ~2,012 lines tests = **~3,240 lines across 5+ files**

**Assessment:** Largest single vector store implementation at 1,228 lines with excellent test coverage
(unit + integration). Includes Docker compose file for integration testing. pgvector is the de facto
standard for PostgreSQL vector search. Has dedicated score normalization and similarity tests.

---

### 11. Elasticsearch

**Recommended package name:** `@langchain/elasticsearch`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/elasticsearch.ts` | 519 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/elasticsearch.int.test.ts` | 418 | Integration |

**Total:** ~937 lines across 2 files

**Assessment:** Significant implementation for a very well-known provider. Tests are integration-only
but substantial (418 lines). Elasticsearch is one of the most widely used search engines.

---

### 12. HNSWLib

**Recommended package name:** `@langchain/hnswlib`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/hnswlib.ts` | 353 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/hnswlib.test.ts` | 82 | Unit |
| `vectorstores/tests/hnswlib.int.test.ts` | 97 | Integration |
| `structured_query/tests/hnswlib_self_query.int.test.ts` | 192 | Integration |

**Total:** ~353 lines source + ~371 lines tests = **~724 lines across 4 files**

**Assessment:** Has both unit and integration tests, plus structured query / self-query integration
testing. Commonly used local vector search library.

---

### 13. Upstash

**Recommended package name:** `@langchain/upstash`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/upstash.ts` | 327 |
| Cache | `caches/upstash_redis.ts` | 104 |
| Storage | `storage/upstash_redis.ts` | 176 |
| Message Store | `stores/message/upstash_redis.ts` | 93 |
| Rate Limiter | `callbacks/handlers/upstash_ratelimit.ts` | 230 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `caches/tests/upstash_redis.test.ts` | 19 | Unit |
| `caches/tests/upstash_redis.int.test.ts` | 38 | Integration |
| `storage/tests/upstash_redis.int.test.ts` | 85 | Integration |
| `stores/tests/redis_upstash.int.test.ts` | 82 | Integration |
| `vectorstores/tests/upstash.int.test.ts` | 288 | Integration |
| `callbacks/tests/upstash_ratelimit.test.ts` | 240 | Unit |

**Total:** ~930 lines source + ~752 lines tests = **~1,682 lines across 11 files**

**Assessment:** Broadest category coverage (5 categories: vectorstore, cache, storage, message store,
rate limiter). Has unit tests for cache and rate limiter. Well-known serverless Redis provider.

---

### 14. Fireworks AI

**Recommended package name:** `@langchain/fireworks`

| Category | Source Files | Lines |
|---|---|---|
| Chat Models | `chat_models/fireworks.ts` | 572 |
| LLMs | `llms/fireworks.ts` | 142 |
| Embeddings | `embeddings/fireworks.ts` | 165 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `chat_models/tests/chatfireworks.int.test.ts` | 114 | Integration |
| `chat_models/tests/chatfireworks.standard.test.ts` | 30 | Standard |
| `chat_models/tests/chatfireworks.standard.int.test.ts` | 30 | Standard Int |
| `chat_models/tests/chatfireworks-agent.int.test.ts` | 43 | Integration |
| `llms/tests/fireworks.int.test.ts` | 24 | Integration |
| `embeddings/tests/fireworks.int.test.ts` | 35 | Integration |

**Total:** ~879 lines source + ~276 lines tests = **~1,155 lines across 9 files**

**Assessment:** Covers the full LLM stack (chat + LLM + embeddings). Has standard tests for chat
models, plus integration tests across all categories. Well-known AI inference provider.

---

### 15. Together AI

**Recommended package name:** `@langchain/togetherai`

| Category | Source Files | Lines |
|---|---|---|
| Chat Models | `chat_models/togetherai.ts` | 527 |
| LLMs | `llms/togetherai.ts` | 328 |
| Embeddings | `embeddings/togetherai.ts` | 197 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `chat_models/tests/chattogetherai.int.test.ts` | 145 | Integration |
| `chat_models/tests/chattogetherai.standard.test.ts` | 30 | Standard |
| `chat_models/tests/chattogetherai.standard.int.test.ts` | 20 | Standard Int |
| `llms/tests/togetherai.test.ts` | 41 | Unit |
| `llms/tests/togetherai.int.test.ts` | 39 | Integration |
| `embeddings/tests/togetherai.int.test.ts` | 19 | Integration |

**Total:** ~1,052 lines source + ~294 lines tests = **~1,346 lines across 9 files**

**Assessment:** Full LLM stack coverage. LLM module has both unit and integration tests. Chat has
standard tests. Well-known AI inference provider.

---

### 16. Azure AI Search

**Recommended package name:** `@langchain/azure-aisearch`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/azure_aisearch.ts` | 778 |
| Doc Loader (Blob Storage File) | `document_loaders/web/azure_blob_storage_file.ts` | 131 |
| Doc Loader (Blob Container) | `document_loaders/web/azure_blob_storage_container.ts` | 95 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/azure_aisearch.test.ts` | 199 | Unit |
| `vectorstores/tests/azure_aisearch.int.test.ts` | 489 | Integration |

**Total:** ~1,004 lines source + ~688 lines tests = **~1,692 lines across 5 files**

**Assessment:** Significant vector store implementation with both unit and integration tests. Azure
Blob Storage loaders add breadth. Azure is a major cloud provider.

---

### 17. Couchbase

**Recommended package name:** `@langchain/couchbase`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store (Query) | `vectorstores/couchbase_query.ts` | 718 |
| Vector Store (Search) | `vectorstores/couchbase_search.ts` | 647 |
| Document Loader | `document_loaders/web/couchbase.ts` | 91 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/couchbase_query.test.ts` | 608 | Unit |
| `vectorstores/tests/couchbase_search.int.test.ts` | 402 | Integration |
| `document_loaders/tests/couchbase.int.test.ts` | 36 | Integration |

**Total:** ~1,456 lines source + ~1,046 lines tests = **~2,502 lines across 6 files**

**Assessment:** Two distinct vector store implementations (Query API vs Search API) plus document
loader. Has unit tests for query path and integration tests for search path. Well-known NoSQL database.

---

### 18. SAP HANA (HANAvector)

**Recommended package name:** `@langchain/hana`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/hanavector.ts` | 923 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/hanavector.test.ts` | 63 | Unit |
| `vectorstores/tests/hanavector.int.test.ts` | 1,325 | Integration |
| `vectorstores/tests/hanavector.fixtures.ts` | 142 | Fixtures |

**Total:** ~923 lines source + ~1,530 lines tests = **~2,453 lines across 4 files**

**Assessment:** Large implementation with very thorough integration tests (1,325 lines — the most
for any single vectorstore). Has unit tests + fixtures too. SAP HANA is a major enterprise database.

---

### 19. Zep

**Recommended package name:** `@langchain/zep`

| Category | Source Files | Lines |
|---|---|---|
| Vector Store | `vectorstores/zep.ts` | 430 |
| Vector Store (Cloud) | `vectorstores/zep_cloud.ts` | 332 |
| Memory | `memory/zep.ts` | 370 |
| Memory (Cloud) | `memory/zep_cloud.ts` | 286 |
| Retriever | `retrievers/zep.ts` | 169 |
| Retriever (Cloud) | `retrievers/zep_cloud.ts` | 161 |
| Message Store | `stores/message/zep_cloud.ts` | 165 |

**Tests:**

| Test File | Lines | Type |
|---|---|---|
| `vectorstores/tests/zep.test.ts` | 316 | Unit |
| `memory/tests/zep_memory.int.test.ts` | 44 | Integration |
| `retrievers/tests/zep.int.test.ts` | 49 | Integration |

**Total:** ~1,913 lines source + ~409 lines tests = **~2,322 lines across 10 files**

**Assessment:** Largest breadth of categories (vector store, memory, retriever, message store) with
both on-premise and cloud variants. Has unit tests for vector store. Tests could be more thorough
for the cloud variants, but the code volume and category breadth is impressive.

---

## Tier 3: Borderline Candidates (meet 2 of 3 criteria well)

These integrations are substantial code from known providers but have weaker test coverage, or
have good tests but are smaller in scope.

### 20. Google Workspace Tools

**Potential package name:** `@langchain/google-tools`

- **Gmail tools:** 7 files, ~741 lines (multi-file directory with base, search, send, draft, etc.)
- **Google Calendar tools:** 11 files, ~739 lines (multi-file with commands, prompts, utils)
- **Google Places/Routes/Scholar/Trends/CustomSearch:** 5 single-file tools, ~880 lines
- **Tests:** Gmail unit (85 lines), Calendar unit (193 lines), individual int tests for Places/Routes/Scholar/Trends

**Assessment:** Very substantial multi-file structure (23+ files). Gmail and Calendar have unit tests.
Note: the Google Vertex AI vector store code that currently lives in community may belong with the
existing `@langchain/google-vertexai` package instead of being a separate package.

---

### 21. DeepInfra

Multi-category (chat + LLM + embeddings, ~588 lines source) but tests are integration-only.

### 22. Llama.cpp

Multi-category (chat + LLM + embeddings + utils, ~761 lines source) but tests are integration-only.

### 23. iFlytek Xinghuo

Multi-file directory structure (chat_models + utils, ~693 lines) but only has integration tests.

### 24. Momento

Multi-category (vector, cache, stores, utils, ~800 lines source) but tests are split: cache has
unit test, vector index is int-only.

### 25. Convex

Multi-category (vector, storage, stores, utils, ~880 lines) but tests are integration-only.

### 26. SingleStore

Substantial single vector store (574 lines) with thorough integration tests (607 lines) but only
single-file.

### 27. MariaDB

Substantial vector store (813 lines) with integration tests (301 lines) but only single-file.

---

## Summary Ranking

| Rank | Provider | Source Lines | Test Lines | Files | Categories | Unit Tests | Int Tests | Std Tests |
|------|----------|-------------|------------|-------|-----------|-----------|----------|----------|
| 1 | **IBM** | 3,176 | 4,178 | 20 | 5 | Yes (all) | Yes (all) | Yes |
| 2 | **pgvector** | 1,228 | 2,012 | 5+ | 1 | Yes | Yes | No |
| 3 | **Alibaba Tongyi** | 1,616 | 1,770 | 5 | 2 | Yes | Yes | Yes |
| 4 | **Neo4j** | 2,321 | 1,370 | 10 | 4 | No | Yes (all) | No |
| 5 | **Cassandra** | 2,141 | 719 | 7 | 4 | No | Yes | No |
| 6 | **Couchbase** | 1,456 | 1,046 | 6 | 3 | Yes (query) | Yes (search) | No |
| 7 | **SAP HANA** | 923 | 1,530 | 4 | 1 | Yes | Yes | No |
| 8 | **Supabase** | 1,298 | 1,190 | 8 | 3 | Yes (vec) | Yes | No |
| 9 | **Zep** | 1,913 | 409 | 10 | 4 | Yes (vec) | Yes | No |
| 10 | **Milvus** | 880 | 1,169 | 4 | 1 | Yes | Yes | No |
| 11 | **Upstash** | 930 | 752 | 11 | 5 | Yes (some) | Yes | No |
| 12 | **Azure AI Search** | 1,004 | 688 | 5 | 2 | Yes | Yes | No |
| 13 | **Chroma** | 658 | 425 | 5 | 2 | Yes | Yes | No |
| 14 | **Together AI** | 1,052 | 294 | 9 | 3 | Yes (LLM) | Yes | Yes |
| 15 | **Fireworks** | 879 | 276 | 9 | 3 | No | Yes | Yes |
| 16 | **FAISS** | 469 | 540 | 3+ | 1 | Yes | Yes | No |
| 17 | **HNSWLib** | 353 | 371 | 4 | 1 | Yes | Yes | No |
| 18 | **Elasticsearch** | 519 | 418 | 2 | 1 | No | Yes | No |
| 19 | **Tencent Hunyuan** | 981 | — | 9 | 3 | Yes (emb) | Yes (chat) | No |

**Note:** Bedrock (community version) is excluded because `@langchain/aws` already exists and covers
the Bedrock chat model + embeddings surface. The community Bedrock code may be legacy or should be
consolidated into `@langchain/aws`.

---

## Contribution History Analysis

Git contribution history (using `--follow` to track renames through the monorepo reorganization)
provides a strong signal of community engagement and usage.

### Contribution Rankings (sorted by total deduplicated commits)

| Rank | Provider | Commits | Authors | Date Range | Most Active Year | Top Contributor |
|------|----------|---------|---------|------------|-----------------|----------------|
| 1 | **Bedrock** (community) | 80 | 26 | 2023-08 → 2026-03 | 2024 (32) | Brace Sproul (19) |
| 2 | **Neo4j** | 61 | 17 | 2023-09 → 2026-03 | 2024 (32) | Tomaz Bratanic (13) |
| 3 | **Supabase** | 54 | 20 | 2023-03 → 2026-03 | 2023 (31) | Jacob Lee (13) |
| 4 | **Chroma** | 54 | 23 | 2023-02 → 2026-03 | 2023 (30) | Jacob Lee (10) |
| 5 | **Milvus** | 50 | 27 | 2023-04 → 2026-03 | 2023 (25) | Jacob Lee (8) |
| 6 | **Upstash** | 50 | 14 | 2023-03 → 2026-03 | 2023 (29) | Jacob Lee (11) |
| 7 | **pgvector** | 47 | 24 | 2023-09 → 2026-03 | 2024 (16) | Jacob Lee (8) |
| 8 | **HNSWLib** | 43 | 13 | 2023-02 → 2026-03 | 2023 (32) | Nuno Campos (15) |
| 9 | **Fireworks AI** | 43 | 13 | 2023-02 → 2026-03 | 2024 (17) | Brace Sproul (10) |
| 10 | **IBM (watsonx)** | 42 | 10 | 2024-10 → 2026-03 | 2025 (26) | Filip Żmijewski (12+11) |
| 11 | **Together AI** | 42 | 11 | 2023-09 → 2026-03 | 2025 (14) | Brace Sproul (13) |
| 12 | **ioredis** | 40 | 11 | 2023-03 → 2026-03 | 2023 (28) | Jacob Lee (10) |
| 13 | **Zep** | 39 | 14 | 2023-05 → 2026-03 | 2023 (24) | Jacob Lee (9) |
| 14 | **Vectara** | 39 | 11 | 2023-06 → 2026-03 | 2023 (24) | Jacob Lee (12) |
| 15 | **Google Workspace Tools** | 34 | 18 | 2023-05 → 2026-03 | 2025 (13) | Hunter Lovell (6) |
| 16 | **Elasticsearch** | 31 | 17 | 2023-04 → 2026-03 | 2023 (18) | Jacob Lee (9) |
| 17 | **Vercel** | 31 | 9 | 2023-06 → 2026-03 | 2023 (14) | Jacob Lee (9) |
| 18 | **Google Vertex AI** (community) | 30 | 12 | 2023-05 → 2026-03 | 2023 (16) | Jacob Lee (7) |
| 19 | **SerpAPI** | 30 | 11 | 2023-02 → 2026-03 | 2023 (25) | Nuno Campos (10) |
| 20 | **Llama.cpp** | 30 | 14 | 2023-08 → 2026-03 | 2024 (12) | Jacob Lee (6) |
| 21 | **FAISS** | 28 | 10 | 2023-05 → 2026-03 | 2023 (14) | Jacob Lee (7) |
| 22 | **Cassandra** | 27 | 8 | 2023-10 → 2026-03 | 2023 (9) | Phil Miesle (6) |
| 23 | **Prisma** | 26 | 16 | 2023-04 → 2026-03 | 2023 (12) | Jacob Lee (3) |
| 24 | **Alibaba Tongyi** | 25 | 13 | 2023-07 → 2026-03 | 2024/2025 (8 each) | Hunter Lovell (5) |
| 25 | **AstraDB** | 25 | 6 | 2023-12 → 2026-03 | 2024 (16) | Jacob Lee (8) |
| 26 | **Momento** | 24 | 9 | 2023-05 → 2026-03 | 2023 (15) | Hunter Lovell (6) |
| 27 | **Xata** | 23 | 10 | 2023-08 → 2026-03 | 2023 (11) | Jacob Lee (5) |
| 28 | **Perplexity** | 22 | 7 | 2025-03 → 2026-03 | 2025 (19) | Hunter Lovell (6) |
| 29 | **DeepInfra** | 21 | 11 | 2023-02 → 2026-03 | 2023/2025 (7 each) | Hunter Lovell (5) |
| 30 | **OpenSearch** | 21 | 14 | 2023-04 → 2026-03 | 2023 (11) | Jacob Lee (4) |
| 31 | **ClickHouse** | 20 | 10 | 2023-04 → 2026-03 | 2023 (11) | Jacob Lee (4) |
| 32 | **Azure AI Search** | 19 | 9 | 2023-07 → 2026-03 | 2024/2025 (7 each) | Yohan Lasorsa (4) |
| 33 | **DynamoDB** | 19 | 9 | 2023-05 → 2026-03 | 2023 (10) | Nuno Campos (4) |
| 34 | **PlanetScale** | 18 | 9 | 2023-05 → 2026-03 | 2023 (10) | Nuno Campos (4) |
| 35 | **Convex** | 17 | 7 | 2023-10 → 2026-03 | 2023 (7) | Christian Bromann (5) |
| 36 | **Firestore** | 16 | 6 | 2023-07 → 2026-03 | 2025 (7) | Hunter Lovell (5) |
| 37 | **SAP HANA** | 15 | 7 | 2024-04 → 2026-03 | 2025 (7) | Hunter Lovell (6) |
| 38 | **SingleStore** | 15 | 7 | 2023-06 → 2026-03 | 2023 (7) | volodymyr-memsql (3) |
| 39 | **iFlytek Xinghuo** | 15 | 8 | 2023-11 → 2026-03 | 2023 (5) | Jacob Lee (3) |
| 40 | **Couchbase** | 14 | 6 | 2024-02 → 2026-03 | 2025 (6) | Hunter Lovell (6) |
| 41 | **Typesense** | 14 | 8 | 2023-06 → 2026-03 | 2023 (6) | Christian Bromann (4) |
| 42 | **Neon** | 14 | 8 | 2023-09 → 2026-03 | 2023 (5) | Jacob Lee (5) |
| 43 | **LibSQL** | 12 | 6 | 2024-10 → 2026-03 | 2024 (5) | Hunter Lovell (3) |
| 44 | **LanceDB** | 10 | 6 | 2023-06 → 2026-03 | 2023 (5) | Jacob Lee (4) |
| 45 | **Tencent Hunyuan** | 9 | 4 | 2024-06 → 2026-03 | 2025/2026 (4 each) | Christian Bromann (5) |
| 46 | **Datadog** | 9 | 5 | 2024-06 → 2026-03 | 2025 (4) | Hunter Lovell (3) |
| 47 | **MariaDB** | 4 | 3 | 2025-03 → 2026-03 | 2025 (3) | Hunter Lovell (2) |

### Key Insights

**High community engagement (external contributors beyond LangChain team):**

- **Neo4j** — Strong vendor investment: Tomaz Bratanic (13 commits), Anej Gorkič (8), Adam Cowley (3)
  from the Neo4j team. 17 unique authors total.
- **Milvus** — Most diverse contributor base: 27 unique authors. Community members include
  GalO005 (4), zac_ma (2), ryjiang (2).
- **pgvector** — 24 unique authors. Notable external: MJDeligan (3), Clemens Peters (2),
  Devin Burnette (2).
- **Chroma** — 23 unique authors. External: Jeff Huber (2), itaismith (2).
- **IBM** — Strong vendor investment: Filip Żmijewski (23 combined), alysaleem (1). Very active
  in 2025 (26 commits) and continuing into 2026 (9 commits).
- **Supabase** — 20 unique authors. External: Jacob Rosenthal (2), Siddharth (1).
- **Upstash** — Strong vendor participation: Fahreddin Özcan (4), Cahid Arda Öz (3).
- **Prisma** — 16 unique authors. External: Nicolas Juelle (2), Alex Shan (2), santree (1).
- **Zep** — Strong vendor investment: Daniel Chalef (8), Sharath Rajasekar (2), Pavlo Paliychuk (1).
- **Perplexity** — Very recent but intense: 22 commits in just 1 year (since 2025-03).
  External: Ranjeet Baraik (4), marvikomo (3), anadi45 (2).

**Still actively maintained (significant 2025-2026 contributions):**

| Provider | 2025 Commits | 2026 Commits | Combined |
|----------|-------------|-------------|----------|
| **IBM** | 26 | 9 | **35** |
| **Bedrock** (already extracted) | 20 | 9 | **29** |
| **Perplexity** | 19 | 3 | **22** |
| **Together AI** | 14 | 5 | **19** |
| **pgvector** | 14 | 4 | **18** |
| **Fireworks AI** | 11 | 3 | **14** |
| **Google Workspace** | 13 | 2 | **15** |
| **Neo4j** | 11 | 4 | **15** |
| **Vercel** | 11 | 2 | **13** |

**Legacy / declining activity (mostly 2023 with little recent):**

- **HNSWLib** — 32 of 43 commits in 2023, only 2 in 2026
- **SerpAPI** — 25 of 30 commits in 2023, 0 in 2025
- **Vectara** — 24 of 39 commits in 2023
- **ioredis** — 28 of 40 commits in 2023
- **PlanetScale** — 10 of 18 in 2023 (PlanetScale itself shut down free tier)

### Combined Score: Code Quality × Contribution Activity

Combining the earlier code quality / test coverage analysis with contribution history,
here is the final prioritized list for separation:

| Priority | Provider | Code Score | Contrib Score | Why Separate |
|----------|----------|-----------|--------------|-------------|
| **P0** | **IBM (watsonx)** | Excellent (all surfaces unit+int+std) | Very High (42 commits, 10 authors, very active 2025-26) | Best overall candidate: broadest integration, best tests, most active |
| **P0** | **Neo4j** | Good (4 categories, int tests) | Very High (61 commits, 17 authors, vendor-invested) | Uniquely broad (vector + graph + chain), strong vendor engagement |
| **P0** | **pgvector** | Excellent (unit+int, 2K test lines) | Very High (47 commits, 24 authors, active) | Most tested vectorstore, active community, de facto standard |
| **P1** | **Supabase** | Good (unit+int for vector) | High (54 commits, 20 authors) | Multi-category, strong test base, well-known |
| **P1** | **Chroma** | Good (unit+int + structured query) | High (54 commits, 23 authors) | Popular open-source vector DB |
| **P1** | **Milvus** | Excellent (unit+int) | High (50 commits, 27 most-diverse authors) | Most diverse contributor community |
| **P1** | **Upstash** | Good (5 categories) | High (50 commits, vendor contributors) | Broadest category coverage, vendor-invested |
| **P1** | **Fireworks AI** | Good (3 categories, standard tests) | High (43 commits, active 2024-25) | Full LLM stack, standard tests |
| **P1** | **Together AI** | Good (3 categories, standard tests) | High (42 commits, active 2025-26) | Full LLM stack, growing activity |
| **P2** | **Alibaba Tongyi** | Excellent (chat tests) | Moderate (25 commits, 13 authors) | Outstanding chat model tests, steady growth |
| **P2** | **Elasticsearch** | Decent (int tests) | Moderate (31 commits, 17 authors) | Major search engine provider |
| **P2** | **Zep** | Good (4 categories) | Moderate (39 commits, vendor-invested) | Broad integration, vendor backing |
| **P2** | **FAISS** | Excellent (unit+int) | Moderate (28 commits) | Great test quality, local-first |
| **P2** | **Azure AI Search** | Good (unit+int) | Moderate (19 commits, Azure-invested) | Major cloud provider |
| **P2** | **Couchbase** | Good (unit+int, 3 categories) | Moderate (14 commits, vendor-driven) | Two distinct vector APIs |
| **P2** | **HNSWLib** | Good (unit+int) | Low-Moderate (43 total but declining) | Tests are good but activity waning |
| **P2** | **SAP HANA** | Excellent (massive int tests) | Low-Moderate (15 commits) | Enterprise DB, thorough tests |
| **P2** | **Perplexity** | Decent (int-only) | High-recent (22 commits in 1yr) | Very active, fast-growing |
| **P3** | **Llama.cpp** | Multi-category but int-only | Moderate (30 commits) | Local inference, steadily used |
| **P3** | **Cassandra** | 4 categories but int-only | Moderate (27 commits) | Enterprise DB |
| **P3** | **Tencent Hunyuan** | Multi-file but split tests | Low (9 commits) | Regional provider, low activity |
| **P3** | **Google Workspace** | Multi-file, mixed tests | Moderate (34 commits) | May belong in existing @langchain/google-* |
| **P3** | **Google Vertex AI** (community) | Multi-file, unit+int | Moderate (30 commits) | Should consolidate into @langchain/google-vertexai |

---

## Comparative Analysis: Existing Provider Packages vs Community Candidates

To calibrate expectations, here is a side-by-side comparison of existing standalone `@langchain/*`
provider packages with the community integrations we are considering for separation.

Human commits exclude bot authors (github-actions[bot], dependabot[bot]). External commits exclude
known LangChain team members (Jacob Lee, Brace Sproul, Hunter Lovell, Christian Bromann, Tat Dat
Duong, Lauren Hirata Singh, Ben Burns, Nuno Campos, Harrison Chase, Colin Francis, David Duong,
pawel-twardziak, and their alt accounts). "Recent" = 2025+2026 combined.

### Existing Standalone Provider Packages

| Package | Human Commits | Authors | External Commits | External Authors | Recent (25+26) | Source Lines |
|---------|--------------|---------|-----------------|-----------------|----------------|-------------|
| `@langchain/openai` | 575 | 57 | 72 | 44 | 360 | 12,234 |
| `@langchain/anthropic` | 401 | 50 | 62 | 37 | 210 | 6,081 |
| `@langchain/google-common` | 278 | 38 | — | — | 168 | 9,707 |
| `@langchain/google-genai` | 257 | 47 | 40 | 34 | 125 | 3,289 |
| `@langchain/mistralai` | 189 | 18 | 12 | 6 | 62 | 2,556 |
| `@langchain/aws` | 161 | 31 | 149 | 22 | 112 | 3,530 |
| `@langchain/google-vertexai` | 169 | 16 | — | — | 101 | 457 |
| `@langchain/groq` | 147 | 20 | 74 | 10 | 75 | 2,197 |
| `@langchain/ollama` | 112 | 23 | 95 | 13 | 82 | 1,759 |
| `@langchain/cloudflare` | 96 | 18 | 53 | 8 | 46 | 1,455 |
| `@langchain/xai` | 94 | 10 | 69 | 1 | 70 | 4,375 |
| `@langchain/mongodb` | 87 | 18 | 59 | 9 | 54 | 888 |
| `@langchain/redis` | 86 | 20 | 60 | 11 | 55 | 3,390 |
| `@langchain/deepseek` | 61 | 9 | 59 | 3 | 61 | 949 |
| `@langchain/google` | 41 | 10 | — | — | 41 | 7,826 |
| `@langchain/google-cloud-sql-pg` | 45 | 10 | 44 | 3 | 45 | 1,786 |
| `@langchain/openrouter` | 12 | 6 | 12 | 4 | 12 | 4,483 |
| `@langchain/turbopuffer` | 7 | 4 | 7 | 2 | 7 | 326 |

**Existing package statistics (excluding Google internal packages):**
- **Median human commits:** ~93 (between Redis at 86 and Cloudflare at 96)
- **Median external authors:** ~8
- **Median source lines:** ~2,377

### Community Integration Candidates (source files only, excluding tests)

| Community Integration | Human Commits | Authors | External Commits | External Authors | Recent (25+26) | Source Lines |
|----------------------|--------------|---------|-----------------|-----------------|----------------|-------------|
| community:**IBM** | 37 | 9 | 37 | 6 | 30 | 3,176 |
| community:**Neo4j** | 41 | 14 | 35 | 8 | 12 | 2,321 |
| community:**pgvector** | 32 | 21 | 26 | 17 | 13 | 1,228 |
| community:**Together AI** | 25 | 10 | 23 | 4 | 13 | 1,052 |
| community:**Fireworks** | 21 | 8 | 16 | 2 | 10 | 879 |
| community:**Google Tools** | 20 | 12 | 18 | 8 | 14 | 2,390 |
| community:**Milvus** | 19 | 12 | 17 | 9 | 10 | 880 |
| community:**Cassandra** | 18 | 6 | 16 | 2 | 10 | 2,141 |
| community:**Chroma** | 18 | 10 | 13 | 5 | 8 | 658 |
| community:**Alibaba Tongyi** | 17 | 10 | 17 | 6 | 12 | 1,616 |
| community:**Upstash** | 16 | 6 | 14 | 3 | 7 | 930 |
| community:**Perplexity** | 16 | 6 | 16 | 3 | 16 | 567 |
| community:**Zep** | 15 | 7 | 12 | 2 | 10 | 1,913 |
| community:**Llama.cpp** | 15 | 9 | 12 | 6 | 6 | 761 |
| community:**Supabase** | 14 | 6 | 9 | 2 | 8 | 1,298 |
| community:**Azure AI Search** | 13 | 7 | 12 | 4 | 8 | 1,004 |
| community:**Elasticsearch** | 12 | 9 | 9 | 7 | 2 | 519 |
| community:**FAISS** | 10 | 4 | 7 | 1 | 7 | 469 |
| community:**SAP HANA** | 9 | 4 | 9 | 2 | 6 | 923 |
| community:**Tencent Hunyuan** | 9 | 4 | 9 | 1 | 8 | 981 |
| community:**Couchbase** | 8 | 4 | 6 | 1 | 6 | 1,456 |
| community:**DeepInfra** | 6 | 5 | 6 | 3 | 3 | 588 |
| community:**HNSWLib** | 5 | 3 | 3 | 0 | 3 | 353 |

### Key Comparative Insights

**1. Community integrations are roughly comparable to smaller existing packages.**

The top community candidates (IBM at 37, Neo4j at 41, pgvector at 32 human commits) are in
the same range as the smaller existing standalone packages like `@langchain/deepseek` (61),
`@langchain/google-cloud-sql-pg` (45), `@langchain/openrouter` (12), and `@langchain/turbopuffer` (7).
This suggests the community candidates have enough contribution activity to justify their own packages.

**2. External contributor diversity is a strong signal.**

| Top by External Authors | Count | Comparison |
|------------------------|-------|------------|
| community:**pgvector** | **17** | Exceeds `@langchain/ollama` (13), `@langchain/redis` (11) |
| community:**Milvus** | **9** | Matches `@langchain/mongodb` (9) |
| community:**Neo4j** | **8** | Matches `@langchain/cloudflare` (8) |
| community:**Google Tools** | **8** | Matches `@langchain/cloudflare` (8) |
| community:**Elasticsearch** | **7** | — |
| community:**IBM** | **6** | Exceeds `@langchain/mistralai` (6) |
| community:**Alibaba Tongyi** | **6** | — |
| community:**Llama.cpp** | **6** | — |

**3. Some community integrations have MORE source code than existing packages.**

| Larger than existing packages | Source Lines | Exceeds |
|-------------------------------|-------------|---------|
| community:**IBM** | 3,176 | `@langchain/groq` (2,197), `@langchain/ollama` (1,759), `@langchain/mongodb` (888) |
| community:**Neo4j** | 2,321 | Same set as above |
| community:**Google Tools** | 2,390 | Same set as above |
| community:**Cassandra** | 2,141 | Same set as above |
| community:**Zep** | 1,913 | `@langchain/ollama` (1,759), `@langchain/mongodb` (888) |
| community:**Alibaba Tongyi** | 1,616 | `@langchain/cloudflare` (1,455), `@langchain/mongodb` (888) |
| community:**Couchbase** | 1,456 | `@langchain/cloudflare` (1,455) |
| community:**Supabase** | 1,298 | `@langchain/deepseek` (949), `@langchain/mongodb` (888) |
| community:**pgvector** | 1,228 | Same as Supabase |

**4. IBM stands out as the clear leader among community candidates.**

IBM has the most recent momentum (30 of 37 human commits in 2025-26), the most source code
(3,176 lines), and the best test coverage (unit + int + standard across all 5 categories).
Its contribution profile already exceeds several existing packages.

**5. Some existing packages were minted with very low initial contribution counts.**

`@langchain/turbopuffer` (7 commits, 4 authors) and `@langchain/openrouter` (12 commits, 6 authors)
were minted as standalone packages with contribution counts lower than all community candidates
except HNSWLib. This sets a low bar for what "deserves its own package" and strengthens the case
for all P0 and P1 candidates.

**6. External author count is a better signal than raw commit count.**

Community integrations have proportionally more external contributions (since LangChain team
maintenance commits are spread across the monorepo). pgvector with 17 external authors, Milvus
with 9, and Neo4j with 8 indicate genuine community/vendor investment comparable to existing
packages like `@langchain/ollama` (13), `@langchain/redis` (11), and `@langchain/groq` (10).
