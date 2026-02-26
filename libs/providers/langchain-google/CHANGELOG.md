# @langchain/google

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
