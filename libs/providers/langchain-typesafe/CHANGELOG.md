# @langchain/typesafe

## 0.1.0

### Minor Changes

- [#12184](https://github.com/langchain-ai/langchainjs/pull/12184) [`5a21380`](https://github.com/langchain-ai/langchainjs/commit/5a213808e6038c822ce323426174229f7da3c924) Thanks [@thushanth-bengre-langchain](https://github.com/thushanth-bengre-langchain)! - feat(typesafe)!: implement `TypeSafeClassifier` as a decision model

  `TypeSafeClassifier` now extends `BaseDecisionModel` from `@langchain/core/decisions` and requires `@langchain/core` >= 1.4.0. This is a breaking change:

  - Questions are passed with each request instead of to the constructor: `new TypeSafeClassifier().invoke({ state, questions })` replaces `new TypeSafeClassifier({ questions }).invoke(state)`
  - Responses are core's `ClassifierResponse`. Token usage is `usage_metadata` (`input_tokens`, `output_tokens`, `total_tokens`) instead of `usage` (`inputTokens`, `outputTokens`)
  - Question and answer types are re-exported from core, and every question requires `instructions`. `ClassificationResponse`, `QuestionContent` (now `Content`), `Usage`, `ValidatedQuestions`, `JsonValue`, and `TypeSafeClassifierCallOptions` are removed
  - Add `Box` questions, and send image content blocks in state or question content as TypeSafe image assets
  - An invalid question now throws a plain `Error` from `invoke` instead of a `TypeSafeError` from the constructor
  - `State` is core's type, which no longer lists `Date`; dates are still sent as ISO strings

### Patch Changes

- [#12192](https://github.com/langchain-ai/langchainjs/pull/12192) [`9920d4b`](https://github.com/langchain-ai/langchainjs/commit/9920d4b33dee5bc0cfb33d859246edf8973c86eb) Thanks [@jkennedyvz](https://github.com/jkennedyvz)! - Require Zod 4.6.6 or newer for installed dependencies to exclude versions affected by GHSA-mrhx-c7xc-m3w5. Zod v3 schemas remain supported through the bundled `zod/v3` entry point.

- [#12186](https://github.com/langchain-ai/langchainjs/pull/12186) [`035b74b`](https://github.com/langchain-ai/langchainjs/commit/035b74b136cec186231715b457803364fc2ffb37) Thanks [@thushanth-bengre-langchain](https://github.com/thushanth-bengre-langchain)! - refactor(typesafe): deprecate experimental middleware

  - Deprecate `autoModeMiddleware` and `modelRouterMiddleware` from `@langchain/typesafe/middleware`. They warn once when called and will be removed in 0.2.0
  - Use `autoModeMiddleware` and `modelRouterMiddleware` from `langchain` with `classifier: new TypeSafeClassifier()` instead

## 0.0.2

### Patch Changes

- [#11670](https://github.com/langchain-ai/langchainjs/pull/11670) [`8837c7a`](https://github.com/langchain-ai/langchainjs/commit/8837c7ab174d657ba9f118c6722bf27f776f7c09) Thanks [@byhow](https://github.com/byhow)! - Add `@langchain/typesafe/middleware`, with `modelRouterMiddleware` for TypeSafe `Choice`-based model routing and `autoModeMiddleware` for blocking risky tool calls with a calibrated TypeSafe `Noul` probability.

## 0.0.1

### Patch Changes

- [#11666](https://github.com/langchain-ai/langchainjs/pull/11666) [`70c42ac`](https://github.com/langchain-ai/langchainjs/commit/70c42acb84b04cf88e7af16b8e1effcdeac6597d) Thanks [@byhow](https://github.com/byhow)! - Add the `@langchain/typesafe` integration package, including `TypeSafeClassifier` for typed classification, scoring, and confidence-aware decisions with TypeSafe's Jev model.
