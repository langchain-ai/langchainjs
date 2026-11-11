---
"@langchain/mistralai": patch
---

fix(mistralai): support the `stop` call option in `ChatMistralAI` — it is now accepted by `ChatMistralAICallOptions`, forwarded to the Mistral API, and reported to LangSmith as `ls_stop`. Empty stop lists and empty-string sequences are no longer sent to the API (also for the `MistralAI` LLM).
