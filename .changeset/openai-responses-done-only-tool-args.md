---
"@langchain/openai": patch
---

Keep tool call arguments on the Responses API stream when a server sends them only in `response.function_call_arguments.done`, `response.custom_tool_call_input.done` or `response.output_item.done`, without argument deltas. Calls that stream every delta are unchanged.
