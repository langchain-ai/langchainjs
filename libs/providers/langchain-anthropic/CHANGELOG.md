# @langchain/anthropic

## 1.3.21

### Patch Changes

- [#10106](https://github.com/langchain-ai/langchainjs/pull/10106) [`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc) Thanks [@hntrl](https://github.com/hntrl)! - Add package version metadata to runnable traces. Each package now stamps its version in `this.metadata.versions` at construction time, making version info available in LangSmith trace metadata.

- [#10166](https://github.com/langchain-ai/langchainjs/pull/10166) [`e9c41f0`](https://github.com/langchain-ai/langchainjs/commit/e9c41f0ab9ea6e7fdeceffa9063a422d4fb62777) Thanks [@kanweiwei](https://github.com/kanweiwei)! - fix(anthropic): only set topP when defined to avoid API error

- Updated dependencies [[`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc), [`403a99f`](https://github.com/langchain-ai/langchainjs/commit/403a99fd826383f30300809ae077e1c967023520), [`3b1fd54`](https://github.com/langchain-ai/langchainjs/commit/3b1fd5458a4aa29c398122829f383f21b5ac39da), [`77bd982`](https://github.com/langchain-ai/langchainjs/commit/77bd98274a885e947d76f7a9c6dd0b3763453218)]:
  - @langchain/core@1.1.29

## 1.3.20

### Patch Changes

- [#10117](https://github.com/langchain-ai/langchainjs/pull/10117) [`66df7fa`](https://github.com/langchain-ai/langchainjs/commit/66df7fa31f43be9eb148bbe0768d26e6d67d6216) Thanks [@hntrl](https://github.com/hntrl)! - fix(anthropic): convert tool_calls to tool_use blocks when AIMessage content is an empty array

  When `AIMessage.content` was an empty array `[]` with `tool_calls` present, the tool calls were silently dropped during message formatting. This caused Anthropic API requests to fail with a 400 error. The array content branch now appends any tool_calls not already represented in the content array as `tool_use` blocks, matching the behavior of the string content path.

- [#10108](https://github.com/langchain-ai/langchainjs/pull/10108) [`e7576ee`](https://github.com/langchain-ai/langchainjs/commit/e7576ee9e6408c399c08d271db43f63e622da10f) Thanks [@hntrl](https://github.com/hntrl)! - fix: replace retired Anthropic model IDs with active replacements
  - Update default model in ChatAnthropic from `claude-3-5-sonnet-latest` to `claude-sonnet-4-5-20250929`
  - Regenerate model profiles with latest data from models.dev API
  - Replace retired `claude-3-5-haiku-20241022`, `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20240620`, and `claude-3-5-sonnet-20241022` in tests, docstrings, and examples

## 1.3.19

### Patch Changes

- [#10080](https://github.com/langchain-ai/langchainjs/pull/10080) [`b583729`](https://github.com/langchain-ai/langchainjs/commit/b583729e99cf0c035630f6b311c4d069a1980cca) Thanks [@hntrl](https://github.com/hntrl)! - Add string-model constructor overloads for chat models (with supporting tests where applicable).

- Updated dependencies [[`fb2226e`](https://github.com/langchain-ai/langchainjs/commit/fb2226e6decdaba21e78b3f01877b45fa1eed6d3)]:
  - @langchain/core@1.1.27

## 1.3.18

### Patch Changes

- [#10077](https://github.com/langchain-ai/langchainjs/pull/10077) [`05396f7`](https://github.com/langchain-ai/langchainjs/commit/05396f7ce0a91c49a3bae4bbcd3dbdd6cbd18089) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(core): add ContextOverflowError, raise in anthropic and openai

- [#10081](https://github.com/langchain-ai/langchainjs/pull/10081) [`5a6f26b`](https://github.com/langchain-ai/langchainjs/commit/5a6f26bbaed80195dc538c538b96219a8b03f38f) Thanks [@hntrl](https://github.com/hntrl)! - feat(core): add namespace-based symbol branding for error class hierarchies

  Introduces `createNamespace` utility for hierarchical symbol-based branding of class hierarchies.
  All LangChain error classes now use this pattern, replacing hand-rolled duck-type `isInstance` checks
  with reliable cross-realm `Symbol.for`-based identity.
  - New `LangChainError` base class that all LangChain errors extend
  - New `createNamespace` / `Namespace` API in `@langchain/core/utils/namespace`
  - Refactored `ModelAbortError`, `ContextOverflowError` to use namespace branding
  - Added `ContextOverflowError.fromError()` static factory method
  - Deprecated `addLangChainErrorFields` in favor of `LangChainError` subclasses
  - Migrated Google provider errors (`GoogleError`, `ConfigurationError`, etc.) to namespace branding
  - Updated Anthropic and OpenAI providers to use `ContextOverflowError.fromError()`

- [#10078](https://github.com/langchain-ai/langchainjs/pull/10078) [`7be50a7`](https://github.com/langchain-ai/langchainjs/commit/7be50a7014d7622e0ab8d303dfc9c633ebc96333) Thanks [@christian-bromann](https://github.com/christian-bromann)! - chore(\*): update model profiles

- Updated dependencies [[`27186c5`](https://github.com/langchain-ai/langchainjs/commit/27186c54884cfe7c2522fa50b42c3ca0ccaefdba), [`05396f7`](https://github.com/langchain-ai/langchainjs/commit/05396f7ce0a91c49a3bae4bbcd3dbdd6cbd18089), [`5a6f26b`](https://github.com/langchain-ai/langchainjs/commit/5a6f26bbaed80195dc538c538b96219a8b03f38f)]:
  - @langchain/core@1.1.25

## 1.3.17

### Patch Changes

- [#9991](https://github.com/langchain-ai/langchainjs/pull/9991) [`dca939d`](https://github.com/langchain-ai/langchainjs/commit/dca939dee687b2a0a0a56dfbb1677ab2cd1ceb62) Thanks [@nickwinder](https://github.com/nickwinder)! - fix(anthropic): update MODEL_DEFAULT_MAX_OUTPUT_TOKENS with correct values for all Claude models

- Updated dependencies [[`d5e3db0`](https://github.com/langchain-ai/langchainjs/commit/d5e3db0d01ab321ec70a875805b2f74aefdadf9d)]:
  - @langchain/core@1.1.21

## 1.3.16

### Patch Changes

- Updated dependencies [[`71c3cba`](https://github.com/langchain-ai/langchainjs/commit/71c3cba843ab16d877299d158a1de0c7d22f3fb9)]:
  - @langchain/core@1.1.20

## 1.3.15

### Patch Changes

- [#9932](https://github.com/langchain-ai/langchainjs/pull/9932) [`4f7f9c7`](https://github.com/langchain-ai/langchainjs/commit/4f7f9c77a42d361d995c938f79772801cd429a9f) Thanks [@hntrl](https://github.com/hntrl)! - feat(anthropic): add Claude Opus 4.6 support with adaptive thinking, effort parameter, compaction API, output_config migration, inference_geo, and structured outputs GA
  - Upgrade `@anthropic-ai/sdk` from `^0.71.0` to `^0.73.0`
  - Add `claude-opus-4-6` model with 16384 default max output tokens
  - Support adaptive thinking (`thinking: { type: "adaptive" }`) recommended for Opus 4.6
  - Add `outputConfig` parameter with effort levels (`low`, `medium`, `high`, `max`) for controlling token usage
  - Migrate `outputFormat` to `outputConfig.format` (backwards compatible, `outputFormat` deprecated)
  - Add compaction API support (beta) with auto-detection of `compact_20260112` edits and streaming handlers for compaction content blocks
  - Add `inferenceGeo` parameter for data residency controls
  - Remove structured-outputs beta header requirement (now GA)

## 1.3.14

### Patch Changes

- Updated dependencies [[`41bfea5`](https://github.com/langchain-ai/langchainjs/commit/41bfea51cf119573a3b956ee782d2731fe71c681)]:
  - @langchain/core@1.1.19

## 1.3.13

### Patch Changes

- [#9881](https://github.com/langchain-ai/langchainjs/pull/9881) [`0c64698`](https://github.com/langchain-ai/langchainjs/commit/0c646989761d11eaa66a3290392ddb94ad54d5bd) Thanks [@marvikomo](https://github.com/marvikomo)! - handle standard file content blocks

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

## 1.3.12

### Patch Changes

- [#9854](https://github.com/langchain-ai/langchainjs/pull/9854) [`160b5bf`](https://github.com/langchain-ai/langchainjs/commit/160b5bfe49f31190d28ec10a95075ef845c49fa3) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(anthropic): apply cache_control at final formatting layer

- [#9852](https://github.com/langchain-ai/langchainjs/pull/9852) [`35c7723`](https://github.com/langchain-ai/langchainjs/commit/35c7723b9953cc417cedb362e697632936d50820) Thanks [@marvikomo](https://github.com/marvikomo)! - Fix image content blocks being silently dropped when using ContentBlock.Multimodal.Image format with url, data, or fileId properties

- [#9841](https://github.com/langchain-ai/langchainjs/pull/9841) [`54dfdce`](https://github.com/langchain-ai/langchainjs/commit/54dfdce99b1d1c16e1024c136ca86e7d78d76d80) Thanks [@yukukotani](https://github.com/yukukotani)! - Fix input_tokens calculation in usage metadata

- Updated dependencies [[`05a9733`](https://github.com/langchain-ai/langchainjs/commit/05a9733448a10764c0bfd070af859c33e623b998)]:
  - @langchain/core@1.1.17

## 1.3.11

### Patch Changes

- [#9809](https://github.com/langchain-ai/langchainjs/pull/9809) [`aeb63b7`](https://github.com/langchain-ai/langchainjs/commit/aeb63b729a575775b19d988a1e14ae17f66a8373) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(anthropic): consolidate input_json_delta blocks in streaming toolcalls

- Updated dependencies [[`70387a1`](https://github.com/langchain-ai/langchainjs/commit/70387a144464539d65a546c8130cf51dfad025a1), [`a7c6ec5`](https://github.com/langchain-ai/langchainjs/commit/a7c6ec51ab9baa186ab5ebf815599c08f5c7e8ab), [`5e04543`](https://github.com/langchain-ai/langchainjs/commit/5e045435a783fdae44bc9a43e01a8e5eb7100db2), [`40b4467`](https://github.com/langchain-ai/langchainjs/commit/40b446762445575844610ee528abc77c247b2c43), [`17e30bd`](https://github.com/langchain-ai/langchainjs/commit/17e30bd7f4c7bdf87c9c30304b3b9e121cc1fbbc)]:
  - @langchain/core@1.1.16

## 1.3.10

### Patch Changes

- [#9792](https://github.com/langchain-ai/langchainjs/pull/9792) [`7169eba`](https://github.com/langchain-ai/langchainjs/commit/7169ebac71574daf370d7c2f5b3e8bbfe4e25df7) Thanks [@xkcm](https://github.com/xkcm)! - Fixed converting partial tool inputs

- Updated dependencies [[`230462d`](https://github.com/langchain-ai/langchainjs/commit/230462d28c3a8b5ccadf433ea2f523eb6e658de6)]:
  - @langchain/core@1.1.15

## 1.3.9

### Patch Changes

- Updated dependencies [[`bd1ab45`](https://github.com/langchain-ai/langchainjs/commit/bd1ab45364391f69ce93ecba36a4a15dafca2b76)]:
  - @langchain/core@1.1.14

## 1.3.8

### Patch Changes

- [#9777](https://github.com/langchain-ai/langchainjs/pull/9777) [`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): properly elevate reasoning tokens

- Updated dependencies [[`3efe79c`](https://github.com/langchain-ai/langchainjs/commit/3efe79c62ff2ffe0ada562f7eecd85be074b649a), [`b8561c1`](https://github.com/langchain-ai/langchainjs/commit/b8561c17556bdf7a3ff8d70bc307422642a9172e)]:
  - @langchain/core@1.1.13

## 1.3.7

### Patch Changes

- Updated dependencies [[`23be5af`](https://github.com/langchain-ai/langchainjs/commit/23be5afd59b5f4806edef11937ce5e2ba300f7ee)]:
  - @langchain/core@1.1.12

## 1.3.6

### Patch Changes

- Updated dependencies [[`a46a249`](https://github.com/langchain-ai/langchainjs/commit/a46a24983fd0fea649d950725a2673b3c435275f)]:
  - @langchain/core@1.1.11

## 1.3.5

### Patch Changes

- Updated dependencies [[`817fc9a`](https://github.com/langchain-ai/langchainjs/commit/817fc9a56d4699f3563a6e153b13eadf7bcc661b)]:
  - @langchain/core@1.1.10

## 1.3.4

### Patch Changes

- Updated dependencies [[`56600b9`](https://github.com/langchain-ai/langchainjs/commit/56600b94f8e185f44d4288b7a9b66c55778938dd), [`dc5c2ac`](https://github.com/langchain-ai/langchainjs/commit/dc5c2ac00f86dd2feeba9843d708926a5f38202e), [`c28d24a`](https://github.com/langchain-ai/langchainjs/commit/c28d24a8770f6d0e543cde116b0e38b3baf21301), [`bfcb87d`](https://github.com/langchain-ai/langchainjs/commit/bfcb87d23c580c7881f650960a448fe2e54a30b3)]:
  - @langchain/core@1.1.9

## 1.3.3

### Patch Changes

- Updated dependencies [[`e5063f9`](https://github.com/langchain-ai/langchainjs/commit/e5063f9c6e9989ea067dfdff39262b9e7b6aba62), [`8996647`](https://github.com/langchain-ai/langchainjs/commit/89966470e8c0b112ce4f9a326004af6a4173f9e6)]:
  - @langchain/core@1.1.8

## 1.3.2

### Patch Changes

- Updated dependencies [[`df9c42b`](https://github.com/langchain-ai/langchainjs/commit/df9c42b3ab61b85309ab47256e1d93c3188435ee), [`8d2982b`](https://github.com/langchain-ai/langchainjs/commit/8d2982bb94c0f4e4314ace3cc98a1ae87571b1ed), [`af664be`](https://github.com/langchain-ai/langchainjs/commit/af664becc0245b2315ea2f784c9a6c1d7622dbb4), [`ffb2402`](https://github.com/langchain-ai/langchainjs/commit/ffb24026cd93e58219519ee24c6e23ea57cb5bde)]:
  - @langchain/core@1.1.7

## 1.3.1

### Patch Changes

- [#9669](https://github.com/langchain-ai/langchainjs/pull/9669) [`5068787`](https://github.com/langchain-ai/langchainjs/commit/50687872ad9f8cf83f42ca6130dd603527ec5402) Thanks [@hntrl](https://github.com/hntrl)! - set empty tool array in invocation params

- Updated dependencies [[`a7b2a7d`](https://github.com/langchain-ai/langchainjs/commit/a7b2a7db5ef57df3731ae6c9931f4b663e909505), [`a496c5f`](https://github.com/langchain-ai/langchainjs/commit/a496c5fc64d94cc0809216325b0f1bfde3f92c45), [`1da1325`](https://github.com/langchain-ai/langchainjs/commit/1da1325aea044fb37af54a9de1f4ae0b9f47d4a2)]:
  - @langchain/core@1.1.6

## 1.3.0

### Minor Changes

- [#9540](https://github.com/langchain-ai/langchainjs/pull/9540) [`ece5c09`](https://github.com/langchain-ai/langchainjs/commit/ece5c09f461e6bcc93142e8f8c07316743e28d76) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named text editor tool

- [#9588](https://github.com/langchain-ai/langchainjs/pull/9588) [`e9a7adc`](https://github.com/langchain-ai/langchainjs/commit/e9a7adca29dab5f1af47bbf7492d5cdebf9675fe) Thanks [@yu-iskw](https://github.com/yu-iskw)! - Expose `ChatAnthropicInput` type for improved type safety and user experience.

  This change introduces a new exported type `ChatAnthropicInput` which is an intersection of `AnthropicInput` and `BaseChatModelParams`. This allows LangChain users to define and pass ChatAnthropic configuration options with full type safety and IntelliSense.

### Patch Changes

- [#9539](https://github.com/langchain-ai/langchainjs/pull/9539) [`12305b4`](https://github.com/langchain-ai/langchainjs/commit/12305b4327f41e60110c72d74c82e12ee27d20a5) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(anthropic): support tool search tool

- [#9614](https://github.com/langchain-ai/langchainjs/pull/9614) [`97de9af`](https://github.com/langchain-ai/langchainjs/commit/97de9afbe7ebaffb7c0b2682a80bf1e9c2187536) Thanks [@iltenahmet](https://github.com/iltenahmet)! - fix(anthropic): Fix `.js` import issue in `chat_models.ts`

- [#9538](https://github.com/langchain-ai/langchainjs/pull/9538) [`4836f6c`](https://github.com/langchain-ai/langchainjs/commit/4836f6c48d8f04ca99c59a27d5a9bf876a6ad805) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named webfetch tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`a0d2d6c`](https://github.com/langchain-ai/langchainjs/commit/a0d2d6cad0455e24f94282d43210030580c7d26a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named computer use tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`34547f5`](https://github.com/langchain-ai/langchainjs/commit/34547f5933a296a7423773e6d1fdd1022ff4936e) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named mcp toolset tool

- Updated dependencies [[`005c729`](https://github.com/langchain-ai/langchainjs/commit/005c72903bcdf090e0f4c58960c8c243481f9874), [`ab78246`](https://github.com/langchain-ai/langchainjs/commit/ab782462753e6c3ae5d55c0c251f795af32929d5), [`8cc81c7`](https://github.com/langchain-ai/langchainjs/commit/8cc81c7cee69530f7a6296c69123edbe227b2fce), [`f32e499`](https://github.com/langchain-ai/langchainjs/commit/f32e4991d0e707324e3f6af287a1ee87ab833b7e), [`a28d83d`](https://github.com/langchain-ai/langchainjs/commit/a28d83d49dd1fd31e67b52a44abc70f2cc2a2026), [`2e5ad70`](https://github.com/langchain-ai/langchainjs/commit/2e5ad70d16c1f13eaaea95336bbe2ec4a4a4954a), [`e456c66`](https://github.com/langchain-ai/langchainjs/commit/e456c661aa1ab8f1ed4a98c40616f5a13270e88e), [`1cfe603`](https://github.com/langchain-ai/langchainjs/commit/1cfe603e97d8711343ae5f1f5a75648e7bd2a16e)]:
  - @langchain/core@1.1.5

## 1.2.3

### Patch Changes

- Updated dependencies [[`0bade90`](https://github.com/langchain-ai/langchainjs/commit/0bade90ed47c7988ed86f1e695a28273c7b3df50), [`6c40d00`](https://github.com/langchain-ai/langchainjs/commit/6c40d00e926f377d249c2919549381522eac8ed1)]:
  - @langchain/core@1.1.4

## 1.2.2

### Patch Changes

- [#9520](https://github.com/langchain-ai/langchainjs/pull/9520) [`cc022b0`](https://github.com/langchain-ai/langchainjs/commit/cc022b0aab2c3959a5036b8d1b9d6ce0b547200e) Thanks [@yukukotani](https://github.com/yukukotani)! - Includes cache creation/read tokens in input_tokens of usage metadata

- Updated dependencies [[`bd2c46e`](https://github.com/langchain-ai/langchainjs/commit/bd2c46e09e661d9ac766c09e71bc6687d6fc811c), [`487378b`](https://github.com/langchain-ai/langchainjs/commit/487378bf14277659c8ca0ef06ea0f9836b818ff4), [`138e7fb`](https://github.com/langchain-ai/langchainjs/commit/138e7fb6280705457079863bedb238b16b322032)]:
  - @langchain/core@1.1.3

## 1.2.1

### Patch Changes

- Updated dependencies [[`833f578`](https://github.com/langchain-ai/langchainjs/commit/833f57834dc3aa64e4cfdd7499f865b2ab41462a)]:
  - @langchain/core@1.1.2

## 1.2.0

### Minor Changes

- [#9531](https://github.com/langchain-ai/langchainjs/pull/9531) [`38f0162`](https://github.com/langchain-ai/langchainjs/commit/38f0162b7b2db2be2c3a75ae468728adcb49fdfb) Thanks [@hntrl](https://github.com/hntrl)! - support advanced tool use

### Patch Changes

- Updated dependencies [[`636b994`](https://github.com/langchain-ai/langchainjs/commit/636b99459bf843362298866211c63a7a15c2a319), [`38f0162`](https://github.com/langchain-ai/langchainjs/commit/38f0162b7b2db2be2c3a75ae468728adcb49fdfb)]:
  - @langchain/core@1.1.1

## 1.1.3

### Patch Changes

- [#9488](https://github.com/langchain-ai/langchainjs/pull/9488) [`cfee39a`](https://github.com/langchain-ai/langchainjs/commit/cfee39a0b867e8cd4ae7bda3d64bba4124be4e10) Thanks [@hntrl](https://github.com/hntrl)! - add opus-4.5 to model strings

## 1.1.2

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.1.1

### Patch Changes

- [#9451](https://github.com/langchain-ai/langchainjs/pull/9451) [`b1deda2`](https://github.com/langchain-ai/langchainjs/commit/b1deda21363b5a1a3f2b7bd77dc1d74764304666) Thanks [@hntrl](https://github.com/hntrl)! - fix betas being passed to client when streaming

## 1.1.0

### Minor Changes

- [#9424](https://github.com/langchain-ai/langchainjs/pull/9424) [`f17b2c9`](https://github.com/langchain-ai/langchainjs/commit/f17b2c9db047fab2d1db2d9aa791ec220cc9dd0a) Thanks [@hntrl](https://github.com/hntrl)! - add support for `betas` param

- [#9424](https://github.com/langchain-ai/langchainjs/pull/9424) [`f17b2c9`](https://github.com/langchain-ai/langchainjs/commit/f17b2c9db047fab2d1db2d9aa791ec220cc9dd0a) Thanks [@hntrl](https://github.com/hntrl)! - add support for native structured output

### Patch Changes

- [#9424](https://github.com/langchain-ai/langchainjs/pull/9424) [`f17b2c9`](https://github.com/langchain-ai/langchainjs/commit/f17b2c9db047fab2d1db2d9aa791ec220cc9dd0a) Thanks [@hntrl](https://github.com/hntrl)! - bump sdk version

## 1.0.1

### Patch Changes

- [#9387](https://github.com/langchain-ai/langchainjs/pull/9387) [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4) Thanks [@hntrl](https://github.com/hntrl)! - Add `ModelProfile` and `.profile` properties to ChatModel

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.3.31

### Patch Changes

- 51f638e: fix content management param

## 0.3.30

### Patch Changes

- 6c7eb84: fix sonnet-4.5 thinking

## 0.3.29

### Patch Changes

- 93493ee: add support for context management
- 93493ee: add support for memory server tools
- 93493ee: add default init options for sonnet-4.5

## 0.3.28

### Patch Changes

- 9ed7dfa: fix unhandled tool choice 'none'

## 0.3.27

### Patch Changes

- 49c242c: fix opus 4.1 topP error when streaming
