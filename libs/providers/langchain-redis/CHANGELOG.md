# @langchain/redis

## 1.1.0

### Minor Changes

- [#9240](https://github.com/langchain-ai/langchainjs/pull/9240) [`6c3cafe`](https://github.com/langchain-ai/langchainjs/commit/6c3cafe981f7e0aac2abd8938f8d3c8c7f1f26c6) Thanks [@tishun](https://github.com/tishun)! - feat(redis): add FluentRedisVectorStore with advanced pre-filtering for document metadata
  - Added `FluentRedisVectorStore` class with type-safe fluent filtering API
  - Added filter expression classes: `Tag`, `Num`, `Text`, `Geo`, `Timestamp`, `Custom`
  - Added `MetadataFieldSchema` array-based schema definition with automatic inference
  - Supports complex filter combinations with AND/OR logic and nesting
  - Existing `RedisVectorStore` preserved for backwards compatibility

## 1.0.1

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.1.4

### Patch Changes

- 86d05ab: add supprt for custom schemas in vectorstore

## 0.1.3

### Patch Changes

- fd4691f: use `keyEncoder` instead of insecure cache key getter

## 0.1.2

### Patch Changes

- 3d235f9: support document deletion by ID in RedisVectorStore
