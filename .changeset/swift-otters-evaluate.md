---
"@langchain/classic": patch
---

Fix `runOnDataset` evaluators under langsmith 0.4 and later

`runOnDataset` ran each evaluator through `Client.evaluateRun`, which
langsmith deprecated and removed in 0.4.0, the lowest version
`@langchain/classic` supports. Any run with `evaluators` or
`customEvaluators` therefore failed with
`TypeError: client.evaluateRun is not a function` once the predictions
finished. It now calls each evaluator's `evaluateRun` itself and logs the
result as feedback with the client, as `Client.evaluateRun` did, so results
contain one `Feedback` per evaluator again.
