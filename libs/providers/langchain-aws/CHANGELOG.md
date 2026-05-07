# @langchain/aws

## 1.3.6

### Patch Changes

- [#10839](https://github.com/langchain-ai/langchainjs/pull/10839) [`c0e8113`](https://github.com/langchain-ai/langchainjs/commit/c0e81131855c875526d5799bb8fd6a86147fd8fc) Thanks [@hntrl](https://github.com/hntrl)! - fix(aws): map Bedrock prompt cache usage metadata to input token details

  Include `cacheReadInputTokens` and `cacheWriteInputTokens` from Bedrock Converse
  responses in `usage_metadata.input_token_details` for both invoke and stream
  metadata handling.

## 1.3.5

### Patch Changes

- [#10688](https://github.com/langchain-ai/langchainjs/pull/10688) [`2ff51cf`](https://github.com/langchain-ai/langchainjs/commit/2ff51cf0688e45d5d237b2b435334b5fd987afa9) Thanks [@hntrl](https://github.com/hntrl)! - normalize Bedrock Converse object errors for tracing

## 1.3.4

### Patch Changes

- [#10658](https://github.com/langchain-ai/langchainjs/pull/10658) [`793bc69`](https://github.com/langchain-ai/langchainjs/commit/793bc69a8af8198de9d157c21070871660e6bb13) Thanks [@colifran](https://github.com/colifran)! - feat(aws): impute file name for document content blocks

## 1.3.3

### Patch Changes

- [#10409](https://github.com/langchain-ai/langchainjs/pull/10409) [`e3fb76b`](https://github.com/langchain-ai/langchainjs/commit/e3fb76b2b019c6aa033c960014d248c322c7d645) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - feat(aws): add defaultHeaders to ChatBedrockConverse

## 1.3.2

### Patch Changes

- [#10288](https://github.com/langchain-ai/langchainjs/pull/10288) [`93e6180`](https://github.com/langchain-ai/langchainjs/commit/93e6180be4a252b575ea0ec9d5f9cab2c3dcb637) Thanks [@hntrl](https://github.com/hntrl)! - feat(aws): Add bedrockApiKey, bedrockApiSecret, and bedrockApiSessionToken to ChatBedrockConverse
  - New constructor fields allow passing AWS credentials directly instead of relying solely on the default credential provider chain
  - Falls back to BEDROCK_AWS_ACCESS_KEY_ID, BEDROCK_AWS_SECRET_ACCESS_KEY, and BEDROCK_AWS_SESSION_TOKEN environment variables
  - Explicit `credentials` field still takes highest priority

## 1.3.1

### Patch Changes

- [#10213](https://github.com/langchain-ai/langchainjs/pull/10213) [`e0b661e`](https://github.com/langchain-ai/langchainjs/commit/e0b661e07f3357ca4dff5a7cf061df76c57965c5) Thanks [@colifran](https://github.com/colifran)! - feat(aws): implement standard schema support for structured output

## 1.3.0

### Minor Changes

- [#10150](https://github.com/langchain-ai/langchainjs/pull/10150) [`4fe6aa3`](https://github.com/langchain-ai/langchainjs/commit/4fe6aa31b50556e183a61737f60c8bef31d0e72b) Thanks [@hntrl](https://github.com/hntrl)! - feat(aws): Add video and audio content block support for ChatBedrockConverse input messages
  - Convert standard multimodal video/audio blocks (base64, Uint8Array, data URL, S3 URI) to Bedrock's native format
  - Pass through native Bedrock video/audio blocks unchanged
  - Adds support for all Bedrock video formats (flv, mkv, mov, mp4, mpeg, mpg, three_gp, webm, wmv) and audio formats (aac, flac, m4a, mka, mkv, mp3, mp4, mpeg, mpga, ogg, opus, pcm, wav, webm, x-aac)

### Patch Changes

- [#10106](https://github.com/langchain-ai/langchainjs/pull/10106) [`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc) Thanks [@hntrl](https://github.com/hntrl)! - Add package version metadata to runnable traces. Each package now stamps its version in `this.metadata.versions` at construction time, making version info available in LangSmith trace metadata.

## 1.2.5

### Patch Changes

- [#10108](https://github.com/langchain-ai/langchainjs/pull/10108) [`e7576ee`](https://github.com/langchain-ai/langchainjs/commit/e7576ee9e6408c399c08d271db43f63e622da10f) Thanks [@hntrl](https://github.com/hntrl)! - fix: replace retired Anthropic model IDs with active replacements
  - Update default model in ChatAnthropic from `claude-3-5-sonnet-latest` to `claude-sonnet-4-5-20250929`
  - Regenerate model profiles with latest data from models.dev API
  - Replace retired `claude-3-5-haiku-20241022`, `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20240620`, and `claude-3-5-sonnet-20241022` in tests, docstrings, and examples

## 1.2.4

### Patch Changes

- [#10080](https://github.com/langchain-ai/langchainjs/pull/10080) [`b583729`](https://github.com/langchain-ai/langchainjs/commit/b583729e99cf0c035630f6b311c4d069a1980cca) Thanks [@hntrl](https://github.com/hntrl)! - Add string-model constructor overloads for chat models (with supporting tests where applicable).

## 1.2.3

### Patch Changes

- [#9976](https://github.com/langchain-ai/langchainjs/pull/9976) [`c67e8a3`](https://github.com/langchain-ai/langchainjs/commit/c67e8a34412855a28f760ac80468865ad206b0d4) Thanks [@akintunero](https://github.com/akintunero)! - Add `modelParameters` and `dimensions` to `BedrockEmbeddings` request payload.

## 1.2.2

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

## 1.2.1

### Patch Changes

- [#9828](https://github.com/langchain-ai/langchainjs/pull/9828) [`85f16ac`](https://github.com/langchain-ai/langchainjs/commit/85f16ace27e1af568be2e779de966f63f8791602) Thanks [@Oscar-Umana](https://github.com/Oscar-Umana)! - fix: map cache points in ToolMessage outside of tool result content block

## 1.2.0

### Minor Changes

- [#9785](https://github.com/langchain-ai/langchainjs/pull/9785) [`01aae02`](https://github.com/langchain-ai/langchainjs/commit/01aae02d9f7253b1f0aea76e4ac614aff24f2370) Thanks [@tinque](https://github.com/tinque)! - Add support for AWS Bedrock service tiers (Priority, Standard, Flex) to the Converse API, aligned with the Python LangChain implementation.

### Patch Changes

- [#9777](https://github.com/langchain-ai/langchainjs/pull/9777) [`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): properly elevate reasoning tokens

- [#9766](https://github.com/langchain-ai/langchainjs/pull/9766) [`5ef217e`](https://github.com/langchain-ai/langchainjs/commit/5ef217e6dc2039588d345b15210c835ec8e75ae5) Thanks [@hntrl](https://github.com/hntrl)! - target standard content trigger appropriately

## 1.1.1

### Patch Changes

- [#9701](https://github.com/langchain-ai/langchainjs/pull/9701) [`9ac29de`](https://github.com/langchain-ai/langchainjs/commit/9ac29de3d3f70c75933913d94ad9a47c6ce39c1d) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain-aws): add support for Amazon Nova embedding models

## 1.1.0

### Minor Changes

- [#9129](https://github.com/langchain-ai/langchainjs/pull/9129) [`6f8fa47`](https://github.com/langchain-ai/langchainjs/commit/6f8fa47388fd5c5d2bc8476e29349720d8fe7784) Thanks [@tinque](https://github.com/tinque)! - feat(aws): allow bedrock Application Inference Profile

## 1.0.3

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.0.2

### Patch Changes

- [#9382](https://github.com/langchain-ai/langchainjs/pull/9382) [`f464366`](https://github.com/langchain-ai/langchainjs/commit/f4643668158a702d086da1defcbfd6ee3f050810) Thanks [@deepansh946](https://github.com/deepansh946)! - fix handling of multiple tool types in convertToConverseTools fn

## 1.0.1

### Patch Changes

- bce4e45: fix(aws): conditional inference config and system message | ChatBedrockConverse

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.1.15

### Patch Changes

- 4a3f5af: Support passing of Bedrock guardrails parameter (#8471)
