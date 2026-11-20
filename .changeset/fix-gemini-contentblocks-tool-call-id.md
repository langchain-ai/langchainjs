---
"@langchain/core": patch
---

Use `functionCall.id` (the Gemini-provided tool call id) instead of the AIMessage's
auto-generated id when building `contentBlocks` tool_call blocks in both Google
block translators (`google.ts` and `google_genai.ts`), so `contentBlocks[].id`
matches `tool_calls[].id`.
