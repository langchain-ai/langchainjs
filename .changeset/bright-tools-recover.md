---
"langchain": minor
---

Preserve recoverable tool errors through `wrapToolCall` middleware and tool-filtered retry/error handlers. Middleware-origin errors and intentional failures from `toolRetryMiddleware` or a declined `toolErrorMiddleware` handler remain fatal by default.

Add `markToolErrorAsFatal(request, error)` for custom middleware that intentionally rethrows a tool error while preserving its identity. Plain passthrough rethrows now produce an error `ToolMessage`; use this helper before rethrowing to preserve intentional fatal behavior. Explicit `ToolNode` `handleToolErrors: true` continues to override middleware error handling.
