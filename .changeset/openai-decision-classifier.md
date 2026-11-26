---
"@langchain/openai": minor
---

feat(openai): add `OpenAIClassifier`, a `BaseDecisionModel` for the OpenAI Decisions API

- Ask `noul`, `choice` and `score` questions through the provider-agnostic decision model interface, matching `OpenAIClassifier` in `langchain-openai` for Python
- `noul` criteria are sent as part of the predicate instructions; `box` questions and single-label `choice` questions are rejected before a request is sent
- A refused question throws `ModelRefusalError`
