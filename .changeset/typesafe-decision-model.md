---
"@langchain/typesafe": minor
---

feat(typesafe)!: implement `TypeSafeClassifier` as a decision model

`TypeSafeClassifier` now extends `BaseDecisionModel` from `@langchain/core/decisions` and requires `@langchain/core` >= 1.4.0. This is a breaking change:

- Questions are passed with each request instead of to the constructor: `new TypeSafeClassifier().invoke({ state, questions })` replaces `new TypeSafeClassifier({ questions }).invoke(state)`
- Responses are core's `ClassifierResponse`. Token usage is `usage_metadata` (`input_tokens`, `output_tokens`, `total_tokens`) instead of `usage` (`inputTokens`, `outputTokens`)
- Question and answer types are re-exported from core, and every question requires `instructions`. `ClassificationResponse`, `QuestionContent` (now `Content`), `Usage`, `ValidatedQuestions`, `JsonValue`, and `TypeSafeClassifierCallOptions` are removed
- Add `Box` questions, and send image content blocks in state or question content as TypeSafe image assets
- An invalid question now throws a plain `Error` from `invoke` instead of a `TypeSafeError` from the constructor
- `State` is core's type, which no longer lists `Date`; dates are still sent as ISO strings
