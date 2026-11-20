# @langchain/ibm

## 0.2.2

### Patch Changes

- [#12252](https://github.com/langchain-ai/langchainjs/pull/12252) [`bbf8a1a`](https://github.com/langchain-ai/langchainjs/commit/bbf8a1af2c668223fd7ac570f0f5b3a4318e3095) Thanks [@thushanth-bengre-langchain](https://github.com/thushanth-bengre-langchain)! - Set `normalized_finish_reason` in `response_metadata` on `invoke` and streamed results (`error` normalizes to `error`); unmapped values normalize to `other`.

## 0.2.1

### Patch Changes

- [#12192](https://github.com/langchain-ai/langchainjs/pull/12192) [`9920d4b`](https://github.com/langchain-ai/langchainjs/commit/9920d4b33dee5bc0cfb33d859246edf8973c86eb) Thanks [@jkennedyvz](https://github.com/jkennedyvz)! - Require Zod 4.6.6 or newer for installed dependencies to exclude versions affected by GHSA-mrhx-c7xc-m3w5. Zod v3 schemas remain supported through the bundled `zod/v3` entry point.

## 0.2.0

### Minor Changes

- [#10924](https://github.com/langchain-ai/langchainjs/pull/10924) [`2e28115`](https://github.com/langchain-ai/langchainjs/commit/2e2811509d75af94f57cedcc3842f178f4c020d1) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(ibm): add native watsonx streamEvents event conversion

## 0.1.1

### Patch Changes

- [#10721](https://github.com/langchain-ai/langchainjs/pull/10721) [`20f27df`](https://github.com/langchain-ai/langchainjs/commit/20f27dff08a4bd5a1a16c1c71a88405c9df82914) Thanks [@peterzaccha](https://github.com/peterzaccha)! - fix(langchain-ibm): handle API errors in streaming responses

## 0.1.0

### Minor Changes

- [#10589](https://github.com/langchain-ai/langchainjs/pull/10589) [`ba03669`](https://github.com/langchain-ai/langchainjs/commit/ba0366964ad4e697cba36404ed298c1b04b6f8a9) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat: add @langchain/ibm package - IBM watsonx.ai integration

### Patch Changes

- Updated dependencies [[`d3d0922`](https://github.com/langchain-ai/langchainjs/commit/d3d0922c24afcd3006fb94dcadd3ebe08fbf2383)]:
  - @langchain/core@1.1.39
