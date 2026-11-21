---
"@langchain/core": patch
---

Treat an empty chunk id in `convertOpenAICompletionsStream` as missing, so the chat model falls back to its run id. Azure OpenAI opens every Chat Completions stream with a content-filter chunk whose id is `""`; that id reached every streamed `AIMessage`, and LangGraph's messages reducer then merged consecutive AI messages that shared it.
