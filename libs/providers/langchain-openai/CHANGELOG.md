# @langchain/openai

## 1.2.1

### Patch Changes

- [#9730](https://github.com/langchain-ai/langchainjs/pull/9730) [`13c9d5b`](https://github.com/langchain-ai/langchainjs/commit/13c9d5bfa3acac7ffb37642e9a50d84dc9004e88) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(openai): pass through provider-native content in ToolMessage without stringification

- [#9737](https://github.com/langchain-ai/langchainjs/pull/9737) [`75b3b90`](https://github.com/langchain-ai/langchainjs/commit/75b3b90c5fa62cbbfa678dfb01f031caed4488ef) Thanks [@hntrl](https://github.com/hntrl)! - fix(openai): pass runManager to \_streamResponseChunks in responses API

## 1.2.0

### Minor Changes

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`eab88a5`](https://github.com/langchain-ai/langchainjs/commit/eab88a5ab7610f5b63212f753ebcbeee2f393622) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): add support for fileSearch tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`5f79bc5`](https://github.com/langchain-ai/langchainjs/commit/5f79bc50aebc093c90b6716c0aebf5c4813d0171) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): support web search tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`7b301c0`](https://github.com/langchain-ai/langchainjs/commit/7b301c00ac851c286a13c2a908757cb40180c768) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): add support for shell tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`bb2f422`](https://github.com/langchain-ai/langchainjs/commit/bb2f422cd8e0d709d82baca44565980abb57120f) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): support code interpreter tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`2a5ba50`](https://github.com/langchain-ai/langchainjs/commit/2a5ba50d240e7d6181546facf088142fbb7b4977) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): add support for local shell tool

- [#9634](https://github.com/langchain-ai/langchainjs/pull/9634) [`47edf3f`](https://github.com/langchain-ai/langchainjs/commit/47edf3fc673eb0627ec585a3a5c2b9381e234527) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): add 'moderateContent' to ChatOpenAI for content moderation #9410

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`2e563e3`](https://github.com/langchain-ai/langchainjs/commit/2e563e332772aa0468f610c334cbedd7f3513ce8) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): add support for apply patch tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`f97b488`](https://github.com/langchain-ai/langchainjs/commit/f97b488200b34c485b15a743277984ecacc62160) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(openai): support for MCP connector tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`6baa851`](https://github.com/langchain-ai/langchainjs/commit/6baa851176b5dde5da19891df114a4645dfe7481) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(langchain): add support for image generation tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`69a1045`](https://github.com/langchain-ai/langchainjs/commit/69a1045e1e14aed9273a1a4085ac35e601a1ecc7) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add support for computer use tool

### Patch Changes

- [#9636](https://github.com/langchain-ai/langchainjs/pull/9636) [`5a01b5b`](https://github.com/langchain-ai/langchainjs/commit/5a01b5b705f6933958f61318b22f00b5f4763be8) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix content in AIMessage for tool and function calls

- [#9570](https://github.com/langchain-ai/langchainjs/pull/9570) [`72795fe`](https://github.com/langchain-ai/langchainjs/commit/72795fe76b515d9edc7d78fb28db59df844ce0c3) Thanks [@ddewaele](https://github.com/ddewaele)! - fixes filename / base64 conversions in openai completions converters (#9512)

- [#9648](https://github.com/langchain-ai/langchainjs/pull/9648) [`29a8480`](https://github.com/langchain-ai/langchainjs/commit/29a8480799d4c3534892a29cef4a135c437deb9b) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): allow to set strict tag manually in providerStrategy #9578

- [#9631](https://github.com/langchain-ai/langchainjs/pull/9631) [`3ecc1e7`](https://github.com/langchain-ai/langchainjs/commit/3ecc1e716704a032e941e670d1d9fbf5370d57aa) Thanks [@jacoblee93](https://github.com/jacoblee93)! - feat(openai): Prefer responses API for 5.2 pro

- [#9591](https://github.com/langchain-ai/langchainjs/pull/9591) [`a552cad`](https://github.com/langchain-ai/langchainjs/commit/a552cad1a463239a0d1d1b5da7798978722738cf) Thanks [@Ayushsingla1](https://github.com/Ayushsingla1)! - add prompt cache retention support

## 1.1.3

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.1.2

### Patch Changes

- [#9408](https://github.com/langchain-ai/langchainjs/pull/9408) [`415cb0b`](https://github.com/langchain-ai/langchainjs/commit/415cb0bfd26207583befdb02367bd12a46b33d51) Thanks [@sinedied](https://github.com/sinedied)! - Fix missing and inconsistent user agent headers

- [#9301](https://github.com/langchain-ai/langchainjs/pull/9301) [`a2ad61e`](https://github.com/langchain-ai/langchainjs/commit/a2ad61e787a06a55a615f63589a65ada05927792) Thanks [@sinedied](https://github.com/sinedied)! - support callable function for apiKey

## 1.1.1

### Patch Changes

- [#9308](https://github.com/langchain-ai/langchainjs/pull/9308) [`04bd55c`](https://github.com/langchain-ai/langchainjs/commit/04bd55c63d8a0cb56f85da0b61a6bd6169b383f3) Thanks [@ro0sterjam](https://github.com/ro0sterjam)! - respect JSON schema references in interopZodTransformInputSchema

- [#9387](https://github.com/langchain-ai/langchainjs/pull/9387) [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4) Thanks [@hntrl](https://github.com/hntrl)! - Add `ModelProfile` and `.profile` properties to ChatModel

- [#9383](https://github.com/langchain-ai/langchainjs/pull/9383) [`39dbe63`](https://github.com/langchain-ai/langchainjs/commit/39dbe63e3d8390bb90bb8b17f00755fa648c5651) Thanks [@hntrl](https://github.com/hntrl)! - export converters

- [#9397](https://github.com/langchain-ai/langchainjs/pull/9397) [`dfbe45f`](https://github.com/langchain-ai/langchainjs/commit/dfbe45f3cfade7a1dbe15b2d702a8e9f8e5ac93a) Thanks [@hntrl](https://github.com/hntrl)! - bump sdk version

## 1.1.0

### Minor Changes

- 8319201: hoist message/tool conversion utilities from classes

### Patch Changes

- 4906522: fix(openai): pair reasoning with function_call id

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.6.16

### Patch Changes

- b8ffc1e: fix(openai): Remove raw OpenAI fields from token usage

## 0.6.15

### Patch Changes

- e63c7cc: fix(openai): Convert OpenAI responses API usage to tracing format

## 0.6.14

### Patch Changes

- d38e9d6: fix(openai): fix streaming in openai

## 0.6.12

### Patch Changes

- 41bd944: support base64 embeddings format
- 707a768: handle undefined disableStreaming to restore streaming functionality

## 0.6.11

### Patch Changes

- 65459e3: use proper casing for reasoning effort param

## 0.6.10

### Patch Changes

- 4a3f5af: add verbosity to json schema response format (#8754)
- 424360b: re-add reasoning_effort param
