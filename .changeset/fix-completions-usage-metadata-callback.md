---
"@langchain/openai": patch
---

fix(openai): emit handleLLMNewToken callback for usage chunk in Completions API streaming

The final usage chunk in `_streamResponseChunks` was only yielded via the async generator but did not call `runManager.handleLLMNewToken()`. This meant callback-based consumers (e.g. LangGraph's `StreamMessagesHandler`) never received the `usage_metadata` chunk. Added the missing `handleLLMNewToken` call to match the behavior of the main streaming loop.
