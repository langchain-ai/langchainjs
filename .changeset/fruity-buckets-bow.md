---
"langchain": patch
---

Fix `ToolNode` to route missing tool errors through `handleToolErrors` instead of throwing, allowing agents to recover when LLMs hallucinate tool names.