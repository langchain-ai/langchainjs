---
"@langchain/aws": patch
"@langchain/core": patch
---

fix(aws): classify Bedrock Converse stream-idle timeouts as `ModelStreamTimeoutError` and cover the pre-response hang window

`ChatBedrockConverse`'s stream watchdog previously threw a bare `Error` with `lc_error_code` nested under `cause`, making the timeout unclassifiable via `LangChainError.isInstance()`. It now throws `ModelStreamTimeoutError` (new export from `@langchain/core/errors`). The `streamIdleTimeout` watchdog also now covers the window before the initial response is received, not just gaps between stream chunks.
