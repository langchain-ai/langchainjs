---
"@langchain/typesafe": patch
---

Add `invoke({ state, questions })` with per-call answer inference and validation before callbacks and tracing. Deprecate constructor-bound questions and raw-state invocation until the next minor version. Export `ClassifierRequest` and `ClassifierResponse` types, derive middleware questions at invocation time, and allow omitting constructor options.
