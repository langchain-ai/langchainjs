---
"@langchain/google": patch
---

fix(google): generate unique tool_call IDs to prevent ToolNode from silently skipping execution

- Use native `functionCall.id` from Gemini API when present, fall back to `uuid.v4()` (matching `@langchain/google-common` behavior)
- Pass `tool_call_id` through as `functionResponse.id` on both v1 standard and legacy code paths
