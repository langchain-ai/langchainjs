# @langchain/mongodb

## 1.3.0

### Minor Changes

- [#10944](https://github.com/langchain-ai/langchainjs/pull/10944) [`32bbacf`](https://github.com/langchain-ai/langchainjs/commit/32bbacfd6df5c5f933fa56ed76265cc51bb8f70d) Thanks [@caseyclements](https://github.com/caseyclements)! - feat(mongodb): add `$rerank` aggregation pipeline support to `MongoDBAtlasVectorSearch`

  Adds an optional `rerankOptions` constructor parameter that appends a `$rerank` stage after `$vectorSearch` to reorder results by semantic relevance using a MongoDB Atlas reranking model. The rerank score is returned as the numeric score in the `[Document, number]` tuple and copied to `document.metadata.relevanceScore`.

- [#11046](https://github.com/langchain-ai/langchainjs/pull/11046) [`e6d2660`](https://github.com/langchain-ai/langchainjs/commit/e6d26605832f827bc3a0ee1cac109deb70b68aad) Thanks [@caseyclements](https://github.com/caseyclements)! - feat(mongodb): add VoyageEmbeddings, migrated from @langchain/community

  `VoyageEmbeddings` is now exported directly from `@langchain/mongodb`. It was previously
  available via `@langchain/community/embeddings/voyage`, which has been removed from this
  monorepo.

  **Migration:** update your import path:

  ```ts
  // before
  import { VoyageEmbeddings } from "@langchain/community/embeddings/voyage";

  // after
  import { VoyageEmbeddings } from "@langchain/mongodb";
  ```

  Note: the default model has been updated from `voyage-01` (retired) to `voyage-3`. If you
  rely on the default, re-embed any existing indexes after migrating.

### Patch Changes

- [#10872](https://github.com/langchain-ai/langchainjs/pull/10872) [`a640079`](https://github.com/langchain-ai/langchainjs/commit/a64007997a4940f51bba3c1c83dae89d1ccfb692) Thanks [@hntrl](https://github.com/hntrl)! - chore(deps): remove redundant @types/uuid declarations

  Remove `@types/uuid` from package manifests that rely on `@langchain/core/utils/uuid` or do not require uuid type stubs directly, and refresh the lockfile entries accordingly.

## 1.2.0

### Minor Changes

- [#10657](https://github.com/langchain-ai/langchainjs/pull/10657) [`b99e9c4`](https://github.com/langchain-ai/langchainjs/commit/b99e9c460f19e35693a34fb76c6244f750b4e0fb) Thanks [@PavelSafronov](https://github.com/PavelSafronov)! - Add MongoDB auto-embed support

## 1.1.1

### Patch Changes

- [#10776](https://github.com/langchain-ai/langchainjs/pull/10776) [`20a9abe`](https://github.com/langchain-ai/langchainjs/commit/20a9abea23ffacf4ae8dc9a7aeec217143bbdeb6) Thanks [@hntrl](https://github.com/hntrl)! - fix(deps): remediate uuid vulnerability by removing direct uuid usage

## 1.1.0

### Minor Changes

- [#8251](https://github.com/langchain-ai/langchainjs/pull/8251) [`49ed8fc`](https://github.com/langchain-ai/langchainjs/commit/49ed8fc15b01e211a5a131905eab21d10accd05f) Thanks [@YasharF](https://github.com/YasharF)! - feat(mongodb): add MongoDB LLM cache

## 1.0.2

### Patch Changes

- [#9502](https://github.com/langchain-ai/langchainjs/pull/9502) [`fa8c36e`](https://github.com/langchain-ai/langchainjs/commit/fa8c36e4ba3ab19c30a1ed9fd2e6392fc6778a2c) Thanks [@hntrl](https://github.com/hntrl)! - bump mongodb dep

## 1.0.1

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.2.0

### Minor Changes

- ac07cc7: Updates the mongodb vector search, memory, and chat history modules to append client metadata
