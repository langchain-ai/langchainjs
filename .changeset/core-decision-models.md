---
"@langchain/core": minor
---

feat(core): add decision models

- Add `@langchain/core/decisions` with `BaseDecisionModel`, a `Runnable` that answers typed `Noul`, `Choice`, `Score`, and `Box` questions about text, messages, or JSON state
- Add question and answer types, `parseQuestions`, and `parseClassifierResponse` for providers
- Type `invoke` answers from the questions asked, including `Choice` labels, and reject provider responses that leave a question unanswered or answer it with the wrong type or label
