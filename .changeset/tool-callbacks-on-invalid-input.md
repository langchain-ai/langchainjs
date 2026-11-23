---
"@langchain/core": patch
---

Start a tool's run before validating its input, so callback handlers and tracers see a call whose arguments fail schema validation: `handleToolStart`, then `handleToolError` with the `ToolInputParsingException`.
