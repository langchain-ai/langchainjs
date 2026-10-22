---
"langchain": patch
---

fix(langchain): propagate non-retryable errors and LangGraph control-flow signals from `toolRetryMiddleware`, `modelRetryMiddleware` and `modelFallbackMiddleware`

Errors that do not match `retryOn` are now re-thrown instead of being turned into a `ToolMessage` or `AIMessage` by `onFailure`. `modelRetryMiddleware` and `modelFallbackMiddleware` no longer retry or fall back on `GraphBubbleUp` signals such as interrupts. This is a behavior change for anyone relying on `onFailure: "continue"` to absorb non-matching errors. To still convert them, add the error type to `retryOn`.
