---
"@langchain/core": minor
---

feat(core): add decision models

- Add `@langchain/core/decisions` with `BaseDecisionModel`, a `Runnable` that answers typed `Noul`, `Choice`, `Score`, and `Box` questions about text, messages, or JSON state
- Add question and answer types, `parseQuestions`, and `parseClassifierResponse` for providers
