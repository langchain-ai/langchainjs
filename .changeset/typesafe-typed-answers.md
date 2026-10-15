---
"@langchain/typesafe": patch
---

`TypeSafeClassifier` now infers each answer's type from the question that asked for it. `Choice` answers narrow to the labels the question declared, `Score` answers to the levels of its rubric, and every answer is reachable without a discriminant check. Type-level only: no runtime change, and existing code keeps compiling.
