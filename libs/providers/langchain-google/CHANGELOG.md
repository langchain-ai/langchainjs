# @langchain/google

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
