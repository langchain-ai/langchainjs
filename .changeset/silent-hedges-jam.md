---
"@langchain/aws": patch
---

fix(aws): put `lc_error_code` directly on Bedrock Converse stream-idle timeouts, cover the pre-response hang window

`ChatBedrockConverse`'s stream watchdog previously threw a bare `Error` with `lc_error_code` nested under `cause`, making the timeout undetectable via a plain `error.lc_error_code` check. It now sets `lc_error_code: "MODEL_STREAM_TIMEOUT"` directly on the error, matching the convention used elsewhere in the codebase. The `streamIdleTimeout` watchdog also now covers the window before the initial response is received, not just gaps between stream chunks.
