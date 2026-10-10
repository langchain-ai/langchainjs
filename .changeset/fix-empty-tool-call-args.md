---
"@langchain/core": patch
---

Fix `streamEvents` v3 turning tool calls with no arguments into `invalid_tool_call` by treating empty accumulated args as `{}`
