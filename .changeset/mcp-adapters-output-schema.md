---
"@langchain/mcp-adapters": patch
---

feat(mcp-adapters): expose MCP tool outputSchema on tool metadata

Forward an MCP tool's optional `outputSchema` onto the resulting `DynamicStructuredTool` metadata (mirroring how `annotations` is already exposed). Previously only `inputSchema` and `annotations` were surfaced, so consumers had to make a second raw `client.listTools()` call to recover the structured-output type. The metadata key is omitted entirely when the tool declares no output schema.
