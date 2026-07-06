---
"langchain": patch
---

fix(langchain): recover from invalid tool args when middleware is present. ToolInvocationError is now converted to a ToolMessage (per the documented handleToolErrors default) even when a wrapToolCall middleware is registered, instead of fatally aborting the agent run.
