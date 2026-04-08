# @langchain/google

## 0.1.10

### Patch Changes

- [#10550](https://github.com/langchain-ai/langchainjs/pull/10550) [`9781bff`](https://github.com/langchain-ai/langchainjs/commit/9781bff525bffdd3b6a75adfa8a30fdb4bfc505e) Thanks [@muhammadosama984](https://github.com/muhammadosama984)! - fix(google): align `mediaResolution` with Gemini scalar values and support `detail` alias mapping (`low`/`high`/`auto`) for media prompts.

## 0.1.9

### Patch Changes

- [#10522](https://github.com/langchain-ai/langchainjs/pull/10522) [`6e2d29e`](https://github.com/langchain-ai/langchainjs/commit/6e2d29e28a8f2a84f6fbbe5755d6b4fe2d5d4fd1) Thanks [@afirstenberg](https://github.com/afirstenberg)! - tests(@langchain/google): Lyria 3

## 0.1.8

### Patch Changes

- [#10471](https://github.com/langchain-ai/langchainjs/pull/10471) [`8f15dd1`](https://github.com/langchain-ai/langchainjs/commit/8f15dd13256647f6c0f40abf6ee7ed949492bd4f) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(@langchain/google): pass abort signal to fetch in non-streaming invoke
  - Added `signal: options.signal` to the `Request` constructor in `_generate`'s non-streaming branch, mirroring what `_streamResponseChunks` already does

- [#10493](https://github.com/langchain-ai/langchainjs/pull/10493) [`63b7268`](https://github.com/langchain-ai/langchainjs/commit/63b72689a1f245037aaa7d910ea4b881ead84856) Thanks [@afirstenberg](https://github.com/afirstenberg)! - Undo regression introduced in [#10397](https://github.com/langchain-ai/langchainjs/issues/10397) in legacy content processing path.
  Fixes issues with a false duplicate functionCall sent in response ([#10474](https://github.com/langchain-ai/langchainjs/issues/10474)).

## 0.1.7

### Patch Changes

- [#10343](https://github.com/langchain-ai/langchainjs/pull/10343) [`a1062b7`](https://github.com/langchain-ai/langchainjs/commit/a1062b74ceb3bfde08765237db92b28eddf3e22e) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix: merge consecutive same-role Gemini content blocks

- [#10313](https://github.com/langchain-ai/langchainjs/pull/10313) [`bc4cd65`](https://github.com/langchain-ai/langchainjs/commit/bc4cd6549b043a811021ae3641f9344ff6537a38) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(langchain-google): parse JSON error bodies from non-JSON content types

- [#10397](https://github.com/langchain-ai/langchainjs/pull/10397) [`955ef6b`](https://github.com/langchain-ai/langchainjs/commit/955ef6b81da7a155bb829ed67ea20f0ad4c3f901) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(google): fix v1 converter dropping tool_calls, text-plain and file blocks

- [#10402](https://github.com/langchain-ai/langchainjs/pull/10402) [`9099f53`](https://github.com/langchain-ai/langchainjs/commit/9099f5362ce1d424b0d820b69ed1ca8fec6be9d3) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(google): use dynamic ls_provider based on platform instead of hardcoded "google"

- [#10415](https://github.com/langchain-ai/langchainjs/pull/10415) [`d7d0bc7`](https://github.com/langchain-ai/langchainjs/commit/d7d0bc70cdb2ea92b365807600fa85ec107ffd0e) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(genai): round-trip thinking content blocks in multi-turn convos

- [#10407](https://github.com/langchain-ai/langchainjs/pull/10407) [`c2960fe`](https://github.com/langchain-ai/langchainjs/commit/c2960fe97a299ed1b748eeab53806badbfd35704) Thanks [@fahe1em1](https://github.com/fahe1em1)! - lazy-load jose in CJS auth helpers

- [#10292](https://github.com/langchain-ai/langchainjs/pull/10292) [`e4193f8`](https://github.com/langchain-ai/langchainjs/commit/e4193f8934b5fdb5f553a7068aca2e945d0e3763) Thanks [@afirstenberg](https://github.com/afirstenberg)! - fixes for Vertex function calls

- [#10400](https://github.com/langchain-ai/langchainjs/pull/10400) [`a870750`](https://github.com/langchain-ai/langchainjs/commit/a870750d6edc002b7987f867fd1aae3b1eabe089) Thanks [@afirstenberg](https://github.com/afirstenberg)! - support role name for function response in Vertex

## 0.1.6

### Patch Changes

- [#10300](https://github.com/langchain-ai/langchainjs/pull/10300) [`a26dc7d`](https://github.com/langchain-ai/langchainjs/commit/a26dc7d2a5b8dae811852e80f5478301b9c4bc93) Thanks [@MaxwellCalkin](https://github.com/MaxwellCalkin)! - resolve functionResponse.name from tool_calls in legacy converter

- [#10314](https://github.com/langchain-ai/langchainjs/pull/10314) [`418a3fc`](https://github.com/langchain-ai/langchainjs/commit/418a3fc1ff2bd4dc73ba52414ff8ec6710bd5572) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - add getLsParams for LangSmith tracing metadata

- [#10267](https://github.com/langchain-ai/langchainjs/pull/10267) [`b68f083`](https://github.com/langchain-ai/langchainjs/commit/b68f083dfeb433aa535c50223935a4059a25be8e) Thanks [@afirstenberg](https://github.com/afirstenberg)! - feat(@langchain/google) Test Gemini 3.1 Flash-Lite

## 0.1.5

### Patch Changes

- [#10260](https://github.com/langchain-ai/langchainjs/pull/10260) [`09babb4`](https://github.com/langchain-ai/langchainjs/commit/09babb49853467b00da460c2af3cc811bbffc685) Thanks [@colifran](https://github.com/colifran)! - feat(google): implement standard schema support for structured output

## 0.1.4

### Patch Changes

- [#10195](https://github.com/langchain-ai/langchainjs/pull/10195) [`05f46ff`](https://github.com/langchain-ai/langchainjs/commit/05f46ff36c12ce5259c2c8e0da89349396f25b8c) Thanks [@hntrl](https://github.com/hntrl)! - fix(google): don't send empty toolConfig when no tool_choice is specified

  When `bindTools()` was called without specifying `tool_choice`, an empty
  `toolConfig: { functionCallingConfig: {} }` was included in the API request.
  This caused the Gemini API to return tool invocations as text (Python code
  blocks) instead of structured `functionCall` parts. Now returns `undefined`
  when no `tool_choice` is set, omitting `toolConfig` from the request entirely
  and letting the API default to AUTO mode.

## 0.1.3

### Patch Changes

- [#10106](https://github.com/langchain-ai/langchainjs/pull/10106) [`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc) Thanks [@hntrl](https://github.com/hntrl)! - Add package version metadata to runnable traces. Each package now stamps its version in `this.metadata.versions` at construction time, making version info available in LangSmith trace metadata.

- [#10164](https://github.com/langchain-ai/langchainjs/pull/10164) [`4eae353`](https://github.com/langchain-ai/langchainjs/commit/4eae353512c8361c530b90ab4e74fd18af774287) Thanks [@hntrl](https://github.com/hntrl)! - fix(google): fix inflated usage_metadata during streaming by converting cumulative token counts to deltas

  The Gemini API sends cumulative `usageMetadata` on every streaming chunk. Previously, these cumulative values were attached directly to each `AIMessageChunk`, causing `mergeUsageMetadata()` to sum them and produce inflated token counts when chunks were concatenated.

  Now the provider tracks previous cumulative values and emits per-chunk deltas, so additive merging produces the correct final totals while still providing meaningful per-chunk usage data when `streamUsage` is enabled.

- [#10170](https://github.com/langchain-ai/langchainjs/pull/10170) [`d42f735`](https://github.com/langchain-ai/langchainjs/commit/d42f735b04d9d42639591fba5639ad65dbb915bf) Thanks [@hntrl](https://github.com/hntrl)! - fix(google): generate unique tool_call IDs to prevent ToolNode from silently skipping execution
  - Use native `functionCall.id` from Gemini API when present, fall back to `uuid.v4()` (matching `@langchain/google-common` behavior)
  - Pass `tool_call_id` through as `functionResponse.id` on both v1 standard and legacy code paths

- [#10072](https://github.com/langchain-ai/langchainjs/pull/10072) [`5f6940d`](https://github.com/langchain-ai/langchainjs/commit/5f6940d49033ec322bcfb426652c68e37c82cbaa) Thanks [@kyrisu](https://github.com/kyrisu)! - fix(google): emit on_chat_model_stream events for non-text content blocks

## 0.1.2

### Patch Changes

- [#10101](https://github.com/langchain-ai/langchainjs/pull/10101) [`a54de44`](https://github.com/langchain-ai/langchainjs/commit/a54de4410be4b5c159b9ee1590a8187017dc9dfc) Thanks [@afirstenberg](https://github.com/afirstenberg)! - add Gemini 3.1 Pro support

## 0.1.1

### Patch Changes

- [#10076](https://github.com/langchain-ai/langchainjs/pull/10076) [`217d2ed`](https://github.com/langchain-ai/langchainjs/commit/217d2ed69896d557ad73c2a388782df68d1d7f51) Thanks [@hntrl](https://github.com/hntrl)! - fix(google): accept both uppercase and lowercase reasoning effort/thinking level values

  Previously, passing uppercase values like `reasoningEffort: "HIGH"` or `"MEDIUM"` would silently
  fail to configure thinking, because `convertReasoningEffortToReasoningTokens` only matched lowercase
  strings. This caused the `thinkingConfig` to be omitted entirely from the API request.
  - Normalize effort input to lowercase in `convertReasoningEffortToReasoningTokens`
  - Extend `Gemini.ThinkingLevel` type to include lowercase variants for better DX
  - Add `LowercaseLiteral` utility type to derive lowercase members from the auto-generated API types

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

## 0.1.0

### Minor Changes

- [#10000](https://github.com/langchain-ai/langchainjs/pull/10000) [`71d08c0`](https://github.com/langchain-ai/langchainjs/commit/71d08c0a3a2597bd5a084eb35a7830e5ea1a2b29) Thanks [@hntrl](https://github.com/hntrl)! - feat(google): add `@langchain/google` -- unified Google/Gemini integration

  New package that replaces the fragmented `@langchain/google-genai` / `@langchain/google-common` / Vertex AI package stack with a single integration.

  Published as 0.1.0 (early release). Existing Google packages will continue to receive maintenance updates.
