---
"langchain": patch
---

Answer unanswered invalid tool calls in createAgent with an error ToolMessage before the next model call, and persist the repair so resumed threads stay valid.
