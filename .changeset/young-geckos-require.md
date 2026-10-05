---
"@langchain/classic": patch
---

Require an `llm` for LLM-based evaluators with a clear error

`loadEvaluator` has had no default model since v1, but the `Criteria` and
`LabeledCriteria` eval configs still documented `llm` as optional with a
GPT-4 default, and `EmbeddingDistance` configs, which need no model, did not
compile without one. An LLM-based evaluator loaded without an `llm` was
returned anyway and failed on every example with
`TypeError: Cannot use 'in' operator to search for 'callKeys' in undefined`.

`LoadEvaluatorOptions.llm` is now optional in the types, and `loadEvaluator`
throws ``The "<type>" evaluator requires an `llm`.`` for the `criteria`,
`labeled_criteria`, `pairwise_string`, `labeled_pairwise_string` and
`trajectory` evaluators when it is missing. `runOnDataset` therefore rejects
with that error, instead of recording a `TypeError` per example, when one of
its evaluator configs has no `llm`. Embedding distance evaluators load
without an `llm` as before.
