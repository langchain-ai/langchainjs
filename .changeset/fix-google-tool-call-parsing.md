---
"@langchain/google": patch
---

fix(google): don't send empty toolConfig when no tool_choice is specified

When `bindTools()` was called without specifying `tool_choice`, an empty
`toolConfig: { functionCallingConfig: {} }` was included in the API request.
This caused the Gemini API to return tool invocations as text (Python code
blocks) instead of structured `functionCall` parts. Now returns `undefined`
when no `tool_choice` is set, omitting `toolConfig` from the request entirely
and letting the API default to AUTO mode.
