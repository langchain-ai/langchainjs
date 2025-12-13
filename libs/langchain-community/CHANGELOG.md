# @langchain/community

## 1.1.0

### Minor Changes

- [#9509](https://github.com/langchain-ai/langchainjs/pull/9509) [`0221458`](https://github.com/langchain-ai/langchainjs/commit/02214588187dc6c036a9334904a6dc000dab4991) Thanks [@phong-phuong](https://github.com/phong-phuong)! - Update Jira document loader with updated v3 API jql endpoint

### Patch Changes

- [#9582](https://github.com/langchain-ai/langchainjs/pull/9582) [`739e2ce`](https://github.com/langchain-ai/langchainjs/commit/739e2ce39bc53aeb2b99faa7a89012ab8657d06e) Thanks [@bitporo](https://github.com/bitporo)! - feat(community): add similaritySearch() and similaritySearchWithScore() support for lancedb

- [#9385](https://github.com/langchain-ai/langchainjs/pull/9385) [`163614e`](https://github.com/langchain-ai/langchainjs/commit/163614e3c11be85e2b06622bc0aa6a5d3bcaaebe) Thanks [@margaretjgu](https://github.com/margaretjgu)! - add elasticsearch hybrid search

- [#9641](https://github.com/langchain-ai/langchainjs/pull/9641) [`005c729`](https://github.com/langchain-ai/langchainjs/commit/005c72903bcdf090e0f4c58960c8c243481f9874) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(community/core): various security fixes

- [#9473](https://github.com/langchain-ai/langchainjs/pull/9473) [`bc758ec`](https://github.com/langchain-ai/langchainjs/commit/bc758ec44c083a43d9c1719b0c2e243763d85171) Thanks [@gbrmaia](https://github.com/gbrmaia)! - add GoogleCalendarDeleteTool

- [#9639](https://github.com/langchain-ai/langchainjs/pull/9639) [`454a93d`](https://github.com/langchain-ai/langchainjs/commit/454a93d5545152adf4a1d35111732b43cc2de5dc) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(community): LlamaCppEmbeddings now returns embeddings instead of token IDs

- [#9214](https://github.com/langchain-ai/langchainjs/pull/9214) [`5e0b88e`](https://github.com/langchain-ai/langchainjs/commit/5e0b88e70152ccdda649a5c9cd07c09932ee311c) Thanks [@mattfoxvog](https://github.com/mattfoxvog)! - fix typo in IBM WatsonxLLM parameter truncateInpuTokens->truncateInputTokens

- [#8948](https://github.com/langchain-ai/langchainjs/pull/8948) [`6af735d`](https://github.com/langchain-ai/langchainjs/commit/6af735d008f7ffadd4336820b954716efa334fa8) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(community): Add INSERT support to PrismaVectorStore for ParentDocumentRetriever compatibility (#8833)

- [#8427](https://github.com/langchain-ai/langchainjs/pull/8427) [`b5aa0bc`](https://github.com/langchain-ai/langchainjs/commit/b5aa0bcfcfd42ec428f50f8b085843fd81677f63) Thanks [@AllenFang](https://github.com/AllenFang)! - improve bm25 sorting function

- [#9225](https://github.com/langchain-ai/langchainjs/pull/9225) [`dc4e3f8`](https://github.com/langchain-ai/langchainjs/commit/dc4e3f8b679b4d77f722379bf4f5cef44c8159c9) Thanks [@noobgramming](https://github.com/noobgramming)! - fix(community): IBM WatsonX ChatWatsonx does not cancel requests on AbortSignal

- [#9590](https://github.com/langchain-ai/langchainjs/pull/9590) [`0dc141d`](https://github.com/langchain-ai/langchainjs/commit/0dc141dac4e851efd858e972bc40835bc42e6c8b) Thanks [@FilipZmijewski](https://github.com/FilipZmijewski)! - fix(community): IBM tests, add missing metadata properties

- Updated dependencies [[`5a01b5b`](https://github.com/langchain-ai/langchainjs/commit/5a01b5b705f6933958f61318b22f00b5f4763be8), [`eab88a5`](https://github.com/langchain-ai/langchainjs/commit/eab88a5ab7610f5b63212f753ebcbeee2f393622), [`5f79bc5`](https://github.com/langchain-ai/langchainjs/commit/5f79bc50aebc093c90b6716c0aebf5c4813d0171), [`316392e`](https://github.com/langchain-ai/langchainjs/commit/316392ea5666008873ab88971f599469ea7a2765), [`7b301c0`](https://github.com/langchain-ai/langchainjs/commit/7b301c00ac851c286a13c2a908757cb40180c768), [`bb2f422`](https://github.com/langchain-ai/langchainjs/commit/bb2f422cd8e0d709d82baca44565980abb57120f), [`2a5ba50`](https://github.com/langchain-ai/langchainjs/commit/2a5ba50d240e7d6181546facf088142fbb7b4977), [`47edf3f`](https://github.com/langchain-ai/langchainjs/commit/47edf3fc673eb0627ec585a3a5c2b9381e234527), [`41b26a4`](https://github.com/langchain-ai/langchainjs/commit/41b26a499625f5f6cd817433832a8d2c2639d2fb), [`2e563e3`](https://github.com/langchain-ai/langchainjs/commit/2e563e332772aa0468f610c334cbedd7f3513ce8), [`72795fe`](https://github.com/langchain-ai/langchainjs/commit/72795fe76b515d9edc7d78fb28db59df844ce0c3), [`f97b488`](https://github.com/langchain-ai/langchainjs/commit/f97b488200b34c485b15a743277984ecacc62160), [`29a8480`](https://github.com/langchain-ai/langchainjs/commit/29a8480799d4c3534892a29cef4a135c437deb9b), [`3ecc1e7`](https://github.com/langchain-ai/langchainjs/commit/3ecc1e716704a032e941e670d1d9fbf5370d57aa), [`6baa851`](https://github.com/langchain-ai/langchainjs/commit/6baa851176b5dde5da19891df114a4645dfe7481), [`a552cad`](https://github.com/langchain-ai/langchainjs/commit/a552cad1a463239a0d1d1b5da7798978722738cf), [`69a1045`](https://github.com/langchain-ai/langchainjs/commit/69a1045e1e14aed9273a1a4085ac35e601a1ecc7)]:
  - @langchain/openai@1.2.0
  - @langchain/classic@1.0.6

## 1.0.7

### Patch Changes

- [#9436](https://github.com/langchain-ai/langchainjs/pull/9436) [`ca32dd7`](https://github.com/langchain-ai/langchainjs/commit/ca32dd76f3f77704da53e38ccb22215dd60aecd2) Thanks [@sinedied](https://github.com/sinedied)! - Fix possible race condition in FileSystemChatMessageHistory

- [#8333](https://github.com/langchain-ai/langchainjs/pull/8333) [`dc396c4`](https://github.com/langchain-ai/langchainjs/commit/dc396c417a07dc1748099c5c71f47ff7e749796a) Thanks [@ejscribner](https://github.com/ejscribner)! - community[minor]: Create CouchbaseQueryVectorStore

- Updated dependencies []:
  - @langchain/classic@1.0.5
  - @langchain/openai@1.1.3

## 1.0.6

### Patch Changes

- [#9501](https://github.com/langchain-ai/langchainjs/pull/9501) [`8b9f66f`](https://github.com/langchain-ai/langchainjs/commit/8b9f66f7212f5fc1607566c130d247c2e17ca546) Thanks [@hntrl](https://github.com/hntrl)! - fix community exports (#9494)

- [#9498](https://github.com/langchain-ai/langchainjs/pull/9498) [`31240d4`](https://github.com/langchain-ai/langchainjs/commit/31240d4314ec3bc776fa8aea7c33870c6ffa5a72) Thanks [@hntrl](https://github.com/hntrl)! - enable model gateway usage in IBM implementation

- Updated dependencies []:
  - @langchain/classic@1.0.5
  - @langchain/openai@1.1.3

## 1.0.5

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

- Updated dependencies [[`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4), [`10fa2af`](https://github.com/langchain-ai/langchainjs/commit/10fa2afec0b81efd3467e61b59ba5c82e1043de5)]:
  - @langchain/openai@1.1.3
  - @langchain/classic@1.0.5

## 1.0.4

### Patch Changes

- [#9326](https://github.com/langchain-ai/langchainjs/pull/9326) [`3e0cab6`](https://github.com/langchain-ai/langchainjs/commit/3e0cab61b32fae271936770b822cb9644f68b637) Thanks [@ayanyev](https://github.com/ayanyev)! - Milvus vector store client: ignore auto-calculated fields in collection schema during payload validation

- Updated dependencies [[`415cb0b`](https://github.com/langchain-ai/langchainjs/commit/415cb0bfd26207583befdb02367bd12a46b33d51), [`a2ad61e`](https://github.com/langchain-ai/langchainjs/commit/a2ad61e787a06a55a615f63589a65ada05927792), [`34c472d`](https://github.com/langchain-ai/langchainjs/commit/34c472d129c9c3d58042fad6479fd15e0763feaf)]:
  - @langchain/openai@1.1.2
  - @langchain/classic@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [[`04bd55c`](https://github.com/langchain-ai/langchainjs/commit/04bd55c63d8a0cb56f85da0b61a6bd6169b383f3), [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4), [`39dbe63`](https://github.com/langchain-ai/langchainjs/commit/39dbe63e3d8390bb90bb8b17f00755fa648c5651), [`dfbe45f`](https://github.com/langchain-ai/langchainjs/commit/dfbe45f3cfade7a1dbe15b2d702a8e9f8e5ac93a)]:
  - @langchain/openai@1.1.1
  - @langchain/classic@1.0.3

## 1.0.2

### Patch Changes

- b17762a: fix(community): export type properly in duckduckgo_search
- e4a3b3b: improve(pdf-loader): update error message to specify support for pdf-parse v1 only
- ecc7a8a: swap problematic eval package
- Updated dependencies [8319201]
- Updated dependencies [4906522]
  - @langchain/openai@1.1.0
  - @langchain/classic@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [dda9ea4]
  - @langchain/classic@1.0.1
  - @langchain/openai@1.0.0

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.3.57

### Patch Changes

- fd4691f: use `keyEncoder` instead of insecure cache key getter
- Updated dependencies [fd4691f]
- Updated dependencies [2f19cd5]
- Updated dependencies [d38e9d6]
- Updated dependencies [3c94076]
  - langchain@0.3.35
  - @langchain/openai@0.6.14

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
