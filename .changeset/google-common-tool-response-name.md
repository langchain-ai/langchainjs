---
"@langchain/google-common": patch
---

fix(google-common): label each tool result's `functionResponse` with the name of the call it answers. The name now comes from the `ToolMessage`'s own `name`, else from the tool call with the same `tool_call_id` in the nearest preceding `AIMessage`, so parallel tool results are no longer labelled with the first call's name (or their call id)
