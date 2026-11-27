---
"langchain": patch
---

fix(langchain): `summarizationMiddleware` no longer replaces the conversation history with `Error generating summary: ...` when the summary model call fails. Transient failures are retried (3 attempts in total, via `withRetry`) and, if the call still fails, the error is thrown and the history is left untouched. This matches the Python `SummarizationMiddleware`.
