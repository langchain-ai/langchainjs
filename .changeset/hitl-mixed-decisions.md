---
"langchain": patch
---

fix(langchain): humanInTheLoopMiddleware — execute approved, edited and auto-approved tool calls when other calls in the same interrupt are rejected, instead of dropping them without a ToolMessage (caused "400 No tool output found for function call" on subsequent model requests)
