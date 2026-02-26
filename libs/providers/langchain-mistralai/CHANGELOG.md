# @langchain/mistralai

## 1.0.5

### Patch Changes

- [#10080](https://github.com/langchain-ai/langchainjs/pull/10080) [`b583729`](https://github.com/langchain-ai/langchainjs/commit/b583729e99cf0c035630f6b311c4d069a1980cca) Thanks [@hntrl](https://github.com/hntrl)! - Add string-model constructor overloads for chat models (with supporting tests where applicable).

## 1.0.4

### Patch Changes

- [#9900](https://github.com/langchain-ai/langchainjs/pull/9900) [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8) Thanks [@hntrl](https://github.com/hntrl)! - Improved abort signal handling for chat models:
  - Added `ModelAbortError` class in `@langchain/core/errors` that contains partial output when a model invocation is aborted mid-stream
  - `invoke()` now throws `ModelAbortError` with accumulated `partialOutput` when aborted during streaming (when using streaming callback handlers)
  - `stream()` throws a regular `AbortError` when aborted (since chunks are already yielded to the caller)
  - All provider implementations now properly check and propagate abort signals in both `_generate()` and `_streamResponseChunks()` methods
  - Added standard tests for abort signal behavior

- [#9900](https://github.com/langchain-ai/langchainjs/pull/9900) [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8) Thanks [@hntrl](https://github.com/hntrl)! - fix(providers): add proper abort signal handling for invoke and stream operations
  - Added early abort check (`signal.throwIfAborted()`) at the start of `_generate` methods to immediately throw when signal is already aborted
  - Added abort signal checks inside streaming loops in `_streamResponseChunks` to return early when signal is aborted
  - Propagated abort signals to underlying SDK calls where applicable (Google GenAI, Google Common/VertexAI, Cohere)
  - Added standard tests for abort signal behavior in `@langchain/standard-tests`

  This enables proper cancellation behavior for both invoke and streaming operations, and allows fallback chains to correctly proceed to the next runnable when the previous one is aborted.

## 1.0.3

### Patch Changes

- [#9807](https://github.com/langchain-ai/langchainjs/pull/9807) [`35df8fb`](https://github.com/langchain-ai/langchainjs/commit/35df8fb592c69d482520ee3ae1a60b05dd48bbb0) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(mistralai): fix type compatibility and streaming issues

## 1.0.2

### Patch Changes

- [#9646](https://github.com/langchain-ai/langchainjs/pull/9646) [`86b651a`](https://github.com/langchain-ai/langchainjs/commit/86b651a4d3616b0c93b6892b76a1d6154b0aae9e) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(mistralai): add useFim option to toggle between FIM and chat APIs

## 1.0.1

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.2.3

### Patch Changes

- 5d24ff1: roll back toolCall and response pairing

## 0.2.2

### Patch Changes

- 9eb78b7: Added logic to ensure toolCalls have corresponding toolResponses when sending messages to the Mistral API
