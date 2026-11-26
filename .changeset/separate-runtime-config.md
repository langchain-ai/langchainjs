---
"@langchain/core": patch
---

Fix LangGraph runtime fields (`store`, `context`) leaking into chat model call options, so model runs no longer trace the whole runtime context.
