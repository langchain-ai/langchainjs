---
"@langchain/mcp-adapters": patch
---

feat(mcp-adapters): forward MCP `_meta` parameter to MCP callTool requests via `beforeToolCall()` interceptor.

Enables applications to attach tracing identifiers, correlation IDs, and other per-request context to tool calls across all transports without exposing the metadata as model-visible arguments, following the [MCP protocol specification for `_meta`](https://modelcontextprotocol.io/specification/draft/basic/index#_meta).
