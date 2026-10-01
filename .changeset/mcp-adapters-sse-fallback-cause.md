---
"@langchain/mcp-adapters": patch
---

Keep the SDK error as `cause` after an HTTP→SSE fallback. When a Streamable HTTP connection falls back to SSE and the SSE attempt fails, the thrown `MCPClientError` now has the SSE attempt's SDK error (an `UnauthorizedError`, or the SSE 401) as its `cause`, one level down as for a direct HTTP or SSE connection, instead of a second `MCPClientError`. Code that checks `UnauthorizedError.isInstance(error.cause)`, such as an OAuth login handler, now works for SSE-only servers too.
