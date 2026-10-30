---
"@langchain/typesafe": minor
---

Breaking change: move classifier questions from the constructor to `invoke({ state, questions })`. Answer types are inferred per call, and questions are validated before callbacks and tracing begin. Export `ClassifierRequest` and `ClassifierResponse` types and derive middleware questions at invocation time.
