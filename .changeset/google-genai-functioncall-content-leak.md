---
"@langchain/google-genai": patch
"@langchain/core": patch
---

Fix ChatGoogleGenerativeAI messages leaking Gemini-native `functionCall` blocks into `content` (duplicating `tool_calls` and breaking handoff to providers like OpenAI that reject unrecognized content types). `ChatGoogleGenAITranslator` now derives `tool_call` content blocks from `message.tool_calls` instead.
