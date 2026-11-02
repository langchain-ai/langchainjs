---
"@langchain/mcp-adapters": patch
---

Connect to and list tools from configured MCP servers concurrently during discovery instead of one server at a time, so `listTools()`/`listToolsets()` take as long as the slowest server rather than the sum of all of them.
