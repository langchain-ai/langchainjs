---
"@langchain/openai": patch
---

Drop Gemini-native `functionCall` content blocks (already carried in `tool_calls`) when converting messages to Chat Completions API params, fixing requests that fail when a `ChatGoogleGenerativeAI` message is passed to `ChatOpenAI` (e.g. a cross-provider handoff in LangGraph).
