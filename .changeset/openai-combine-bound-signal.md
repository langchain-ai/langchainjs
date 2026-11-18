---
"@langchain/openai": patch
---

Fixed ChatOpenAI ignoring a signal bound with withConfig or bindTools when the caller also passed a signal, so the request now aborts when either signal aborts
