---
"@langchain/openai": patch
"langchain": patch
---

Support GPT-6 models: route them to the Responses API so function tools work with reasoning, and infer the openai provider for them in `initChatModel`.
