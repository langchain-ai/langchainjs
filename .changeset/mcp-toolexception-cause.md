---
"@langchain/mcp-adapters": patch
---

Preserve the original error as `cause` when wrapping tool call failures in `ToolException`, so structured details like `McpError.code` survive for programmatic handling.
