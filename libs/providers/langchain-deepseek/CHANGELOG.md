# @langchain/deepseek

## 1.0.14

### Patch Changes

- Updated dependencies [[`62ba83e`](https://github.com/langchain-ai/langchainjs/commit/62ba83edd5206c86d8da8d1b608a2493ee4f3da8)]:
  - @langchain/openai@1.2.10

## 1.0.13

### Patch Changes

- [#10080](https://github.com/langchain-ai/langchainjs/pull/10080) [`b583729`](https://github.com/langchain-ai/langchainjs/commit/b583729e99cf0c035630f6b311c4d069a1980cca) Thanks [@hntrl](https://github.com/hntrl)! - Add string-model constructor overloads for chat models (with supporting tests where applicable).

- Updated dependencies [[`b583729`](https://github.com/langchain-ai/langchainjs/commit/b583729e99cf0c035630f6b311c4d069a1980cca)]:
  - @langchain/openai@1.2.9

## 1.0.12

### Patch Changes

- [#10078](https://github.com/langchain-ai/langchainjs/pull/10078) [`7be50a7`](https://github.com/langchain-ai/langchainjs/commit/7be50a7014d7622e0ab8d303dfc9c633ebc96333) Thanks [@christian-bromann](https://github.com/christian-bromann)! - chore(\*): update model profiles

- Updated dependencies [[`05396f7`](https://github.com/langchain-ai/langchainjs/commit/05396f7ce0a91c49a3bae4bbcd3dbdd6cbd18089), [`5a6f26b`](https://github.com/langchain-ai/langchainjs/commit/5a6f26bbaed80195dc538c538b96219a8b03f38f), [`7be50a7`](https://github.com/langchain-ai/langchainjs/commit/7be50a7014d7622e0ab8d303dfc9c633ebc96333)]:
  - @langchain/openai@1.2.8

## 1.0.11

### Patch Changes

- Updated dependencies [[`6939dab`](https://github.com/langchain-ai/langchainjs/commit/6939dabc8dc6481942e7e2c19e3dc61bc374d65a), [`ad581c7`](https://github.com/langchain-ai/langchainjs/commit/ad581c76138ea12ebdaee444c0dcdc4f6a280624)]:
  - @langchain/openai@1.2.7

## 1.0.10

### Patch Changes

- Updated dependencies [[`16d691c`](https://github.com/langchain-ai/langchainjs/commit/16d691c7f8196e1d6322f051c25b2219ff2953b6), [`1058574`](https://github.com/langchain-ai/langchainjs/commit/1058574b723f0d060eb9b3ca25be5aeeabbe51aa)]:
  - @langchain/openai@1.2.6

## 1.0.9

### Patch Changes

- Updated dependencies [[`0870ca0`](https://github.com/langchain-ai/langchainjs/commit/0870ca0719dacd8a555b3341e581d6c15cd6faf3), [`cf46089`](https://github.com/langchain-ai/langchainjs/commit/cf46089d250b1ec87f99956f5cd87e2615ac25c5)]:
  - @langchain/openai@1.2.5

## 1.0.8

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

- Updated dependencies [[`1fa865b`](https://github.com/langchain-ai/langchainjs/commit/1fa865b1cb8a30c2269b83cdb5fc84d374c3fca9), [`28efb57`](https://github.com/langchain-ai/langchainjs/commit/28efb57448933368094ca41c63d9262ac0f348a6), [`4e42452`](https://github.com/langchain-ai/langchainjs/commit/4e42452e4c020408bd6687667e931497b05aaff5), [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8), [`a9b5059`](https://github.com/langchain-ai/langchainjs/commit/a9b50597186002221aaa4585246e569fa44c27c8)]:
  - @langchain/openai@1.2.4

## 1.0.7

### Patch Changes

- [#9726](https://github.com/langchain-ai/langchainjs/pull/9726) [`1877454`](https://github.com/langchain-ai/langchainjs/commit/1877454e6a501eba7bf36fc088335eaea149c8ce) Thanks [@murataslan1](https://github.com/murataslan1)! - fix(deepseek): parse <think> tags in content stream

- Updated dependencies []:
  - @langchain/openai@1.2.3

## 1.0.6

### Patch Changes

- Updated dependencies [[`a7c6ec5`](https://github.com/langchain-ai/langchainjs/commit/a7c6ec51ab9baa186ab5ebf815599c08f5c7e8ab), [`04923f9`](https://github.com/langchain-ai/langchainjs/commit/04923f9835e5b3677c180b601ae8f3e7d8be0236), [`e16c218`](https://github.com/langchain-ai/langchainjs/commit/e16c218b81980a1c576af5192342019975bb95b9)]:
  - @langchain/openai@1.2.3

## 1.0.5

### Patch Changes

- [#9777](https://github.com/langchain-ai/langchainjs/pull/9777) [`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): properly elevate reasoning tokens

- Updated dependencies [[`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a)]:
  - @langchain/openai@1.2.2

## 1.0.4

### Patch Changes

- Updated dependencies [[`13c9d5b`](https://github.com/langchain-ai/langchainjs/commit/13c9d5bfa3acac7ffb37642e9a50d84dc9004e88), [`75b3b90`](https://github.com/langchain-ai/langchainjs/commit/75b3b90c5fa62cbbfa678dfb01f031caed4488ef)]:
  - @langchain/openai@1.2.1

## 1.0.3

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
