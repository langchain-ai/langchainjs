# @langchain/xai

## 1.3.1

### Patch Changes

- Updated dependencies [[`0870ca0`](https://github.com/langchain-ai/langchainjs/commit/0870ca0719dacd8a555b3341e581d6c15cd6faf3), [`cf46089`](https://github.com/langchain-ai/langchainjs/commit/cf46089d250b1ec87f99956f5cd87e2615ac25c5)]:
  - @langchain/openai@1.2.5

## 1.3.0

### Minor Changes

- [#9890](https://github.com/langchain-ai/langchainjs/pull/9890) [`e3ea086`](https://github.com/langchain-ai/langchainjs/commit/e3ea086121b5936668ba01ae43f8087df9263ab3) Thanks [@hntrl](https://github.com/hntrl)! - feat(xai): add server-side agentic tools and deprecate live_search

  Added new xAI server-side agentic tools for the Responses API:
  - `xaiWebSearch()`: Web search with domain filtering and image understanding
  - `xaiXSearch()`: X (Twitter) search with handle filtering, date ranges, and media understanding
  - `xaiCodeExecution()`: Python code execution for calculations and analysis
  - `xaiCollectionsSearch()`: Search through uploaded knowledge bases (vector stores)

  Also:
  - Deprecated `xaiLiveSearch()` with migration guidance to new tools
  - Added `tools` support to `ChatXAIResponses` constructor and call options
  - Updated `XAIResponsesWebSearchTool` type with correct filtering options

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

- [#9889](https://github.com/langchain-ai/langchainjs/pull/9889) [`b303711`](https://github.com/langchain-ai/langchainjs/commit/b303711736e06f3c04d6bb5f50032da2dfb021f3) Thanks [@hntrl](https://github.com/hntrl)! - feat(xai): add baseURL option to ChatXAI

  Added `baseURL` configuration option to `ChatXAI` class, allowing users to override the default xAI API endpoint. This is useful for connecting to custom endpoints, proxies, or alternative API-compatible services.

- Updated dependencies [[`1fa865b`](https://github.com/langchain-ai/langchainjs/commit/1fa865b1cb8a30c2269b83cdb5fc84d374c3fca9), [`28efb57`](https://github.com/langchain-ai/langchainjs/commit/28efb57448933368094ca41c63d9262ac0f348a6), [`4e42452`](https://github.com/langchain-ai/langchainjs/commit/4e42452e4c020408bd6687667e931497b05aaff5), [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8), [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8)]:
  - @langchain/openai@1.2.4

## 1.2.2

### Patch Changes

- Updated dependencies [[`a7c6ec5`](https://github.com/langchain-ai/langchainjs/commit/a7c6ec51ab9baa186ab5ebf815599c08f5c7e8ab), [`04923f9`](https://github.com/langchain-ai/langchainjs/commit/04923f9835e5b3677c180b601ae8f3e7d8be0236), [`e16c218`](https://github.com/langchain-ai/langchainjs/commit/e16c218b81980a1c576af5192342019975bb95b9)]:
  - @langchain/openai@1.2.3

## 1.2.1

### Patch Changes

- [#9777](https://github.com/langchain-ai/langchainjs/pull/9777) [`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): properly elevate reasoning tokens

- Updated dependencies [[`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a)]:
  - @langchain/openai@1.2.2

## 1.2.0

### Minor Changes

- [#9718](https://github.com/langchain-ai/langchainjs/pull/9718) [`739d4e8`](https://github.com/langchain-ai/langchainjs/commit/739d4e88cc78b8f578ab019b526c97d63d9c2144) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - feat(xai): responses implementation

### Patch Changes

- Updated dependencies []:
  - @langchain/openai@1.2.1

## 1.1.1

### Patch Changes

- Updated dependencies [[`13c9d5b`](https://github.com/langchain-ai/langchainjs/commit/13c9d5bfa3acac7ffb37642e9a50d84dc9004e88), [`75b3b90`](https://github.com/langchain-ai/langchainjs/commit/75b3b90c5fa62cbbfa678dfb01f031caed4488ef)]:
  - @langchain/openai@1.2.1

## 1.1.0

### Minor Changes

- [#9537](https://github.com/langchain-ai/langchainjs/pull/9537) [`49250c1`](https://github.com/langchain-ai/langchainjs/commit/49250c156edeb2952c25e3f17d4de5df44753835) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - Adds native Live Search support to xAI provider

### Patch Changes

- Updated dependencies [[`5a01b5b`](https://github.com/langchain-ai/langchainjs/commit/5a01b5b705f6933958f61318b22f00b5f4763be8), [`eab88a5`](https://github.com/langchain-ai/langchainjs/commit/eab88a5ab7610f5b63212f753ebcbeee2f393622), [`5f79bc5`](https://github.com/langchain-ai/langchainjs/commit/5f79bc50aebc093c90b6716c0aebf5c4813d0171), [`7b301c0`](https://github.com/langchain-ai/langchainjs/commit/7b301c00ac851c286a13c2a908757cb40180c768), [`bb2f422`](https://github.com/langchain-ai/langchainjs/commit/bb2f422cd8e0d709d82baca44565980abb57120f), [`2a5ba50`](https://github.com/langchain-ai/langchainjs/commit/2a5ba50d240e7d6181546facf088142fbb7b4977), [`47edf3f`](https://github.com/langchain-ai/langchainjs/commit/47edf3fc673eb0627ec585a3a5c2b9381e234527), [`2e563e3`](https://github.com/langchain-ai/langchainjs/commit/2e563e332772aa0468f610c334cbedd7f3513ce8), [`72795fe`](https://github.com/langchain-ai/langchainjs/commit/72795fe76b515d9edc7d78fb28db59df844ce0c3), [`f97b488`](https://github.com/langchain-ai/langchainjs/commit/f97b488200b34c485b15a743277984ecacc62160), [`29a8480`](https://github.com/langchain-ai/langchainjs/commit/29a8480799d4c3534892a29cef4a135c437deb9b), [`3ecc1e7`](https://github.com/langchain-ai/langchainjs/commit/3ecc1e716704a032e941e670d1d9fbf5370d57aa), [`6baa851`](https://github.com/langchain-ai/langchainjs/commit/6baa851176b5dde5da19891df114a4645dfe7481), [`a552cad`](https://github.com/langchain-ai/langchainjs/commit/a552cad1a463239a0d1d1b5da7798978722738cf), [`69a1045`](https://github.com/langchain-ai/langchainjs/commit/69a1045e1e14aed9273a1a4085ac35e601a1ecc7)]:
  - @langchain/openai@1.2.0

## 1.0.2

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

- Updated dependencies [[`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4)]:
  - @langchain/openai@1.1.3

## 1.0.1

### Patch Changes

- [#9387](https://github.com/langchain-ai/langchainjs/pull/9387) [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4) Thanks [@hntrl](https://github.com/hntrl)! - Add `ModelProfile` and `.profile` properties to ChatModel

- Updated dependencies [[`04bd55c`](https://github.com/langchain-ai/langchainjs/commit/04bd55c63d8a0cb56f85da0b61a6bd6169b383f3), [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4), [`39dbe63`](https://github.com/langchain-ai/langchainjs/commit/39dbe63e3d8390bb90bb8b17f00755fa648c5651), [`dfbe45f`](https://github.com/langchain-ai/langchainjs/commit/dfbe45f3cfade7a1dbe15b2d702a8e9f8e5ac93a)]:
  - @langchain/openai@1.1.1

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.
