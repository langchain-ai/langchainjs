# @langchain/standard-tests

## 0.0.22

### Patch Changes

- Updated dependencies [[`41bfea5`](https://github.com/langchain-ai/langchainjs/commit/41bfea51cf119573a3b956ee782d2731fe71c681)]:
  - @langchain/core@1.1.19

## 0.0.21

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

- Updated dependencies [[`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8), [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8)]:
  - @langchain/core@1.1.18

## 0.0.20

### Patch Changes

- Updated dependencies [[`05a9733`](https://github.com/langchain-ai/langchainjs/commit/05a9733448a10764c0bfd070af859c33e623b998)]:
  - @langchain/core@1.1.17

## 0.0.19

### Patch Changes

- Updated dependencies [[`70387a1`](https://github.com/langchain-ai/langchainjs/commit/70387a144464539d65a546c8130cf51dfad025a1), [`a7c6ec5`](https://github.com/langchain-ai/langchainjs/commit/a7c6ec51ab9baa186ab5ebf815599c08f5c7e8ab), [`5e04543`](https://github.com/langchain-ai/langchainjs/commit/5e045435a783fdae44bc9a43e01a8e5eb7100db2), [`40b4467`](https://github.com/langchain-ai/langchainjs/commit/40b446762445575844610ee528abc77c247b2c43), [`17e30bd`](https://github.com/langchain-ai/langchainjs/commit/17e30bd7f4c7bdf87c9c30304b3b9e121cc1fbbc)]:
  - @langchain/core@1.1.16

## 0.0.18

### Patch Changes

- Updated dependencies [[`230462d`](https://github.com/langchain-ai/langchainjs/commit/230462d28c3a8b5ccadf433ea2f523eb6e658de6)]:
  - @langchain/core@1.1.15

## 0.0.17

### Patch Changes

- Updated dependencies [[`bd1ab45`](https://github.com/langchain-ai/langchainjs/commit/bd1ab45364391f69ce93ecba36a4a15dafca2b76)]:
  - @langchain/core@1.1.14

## 0.0.16

### Patch Changes

- Updated dependencies [[`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a), [`b8561c1`](https://github.com/langchain-ai/langchainjs/commit/b8561c17556bdf7a3ff8d70bc307422642a9172e)]:
  - @langchain/core@1.1.13

## 0.0.15

### Patch Changes

- Updated dependencies [[`23be5af`](https://github.com/langchain-ai/langchainjs/commit/23be5afd59b5f4806edef11937ce5e2ba300f7ee)]:
  - @langchain/core@1.1.12
