# @langchain/ollama

## 1.2.0

### Minor Changes

- [#9758](https://github.com/langchain-ai/langchainjs/pull/9758) [`442197d`](https://github.com/langchain-ai/langchainjs/commit/442197dbbae63deb884d65bc692d73dc3191b056) Thanks [@Gulianrdgd](https://github.com/Gulianrdgd)! - Adds support for the `think` parameter to the `Ollama` LLM class

### Patch Changes

- [#9777](https://github.com/langchain-ai/langchainjs/pull/9777) [`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): properly elevate reasoning tokens

## 1.1.0

### Minor Changes

- [#9580](https://github.com/langchain-ai/langchainjs/pull/9580) [`c1f6dcf`](https://github.com/langchain-ai/langchainjs/commit/c1f6dcf381a8a11d91ecc3c586df0b140853c243) Thanks [@jonghwanhyeon](https://github.com/jonghwanhyeon)! - feat(ollama): add support for native structured outputs

### Patch Changes

- [#9611](https://github.com/langchain-ai/langchainjs/pull/9611) [`7948fd2`](https://github.com/langchain-ai/langchainjs/commit/7948fd269533179c94841f908741abeb5db94163) Thanks [@jonghwanhyeon](https://github.com/jonghwanhyeon)! - fix(ollama): switch default test model to mistral and fix standard tests

- [#9607](https://github.com/langchain-ai/langchainjs/pull/9607) [`bd990d5`](https://github.com/langchain-ai/langchainjs/commit/bd990d5cf918308b74f4dd99322ae5602a405fd6) Thanks [@jonghwanhyeon](https://github.com/jonghwanhyeon)! - feat(ollama): add support for custom baseUrl

## 1.0.3

### Patch Changes

- [#9490](https://github.com/langchain-ai/langchainjs/pull/9490) [`57fe46f`](https://github.com/langchain-ai/langchainjs/commit/57fe46fdef09146814bf811dee6e439e01ced9a8) Thanks [@christian-bromann](https://github.com/christian-bromann)! - separate thinking content into reasoning_content field

## 1.0.2

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

- [#9470](https://github.com/langchain-ai/langchainjs/pull/9470) [`960bd46`](https://github.com/langchain-ai/langchainjs/commit/960bd46d5916146c68a8a91fe7126e5408f06458) Thanks [@loehde](https://github.com/loehde)! - fix(deps): update ollama dependency to version 0.6.3 and add dimensio…

## 1.0.1

### Patch Changes

- a2bce18: fix(ollama): support parsing structured output from tool calls

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.2.4

### Patch Changes

- 9e843eb: Add think Field to ChatOllama for Controlling Thought Process in Responses
