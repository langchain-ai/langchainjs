---
"langchain": patch
---

fix(langchain): handle tool errors that pass through `wrapToolCall` middleware as tool errors

A tool error that a `wrapToolCall` middleware only passes through now becomes an error `ToolMessage`, as it does without middleware, instead of failing the run. Errors a middleware raises itself still fail the run, as do `toolRetryMiddleware({ onFailure: "error" })` and unhandled errors in `toolErrorMiddleware`.
