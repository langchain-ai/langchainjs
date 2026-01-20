---
"@langchain/core": patch
---

read error.status when response.status is absent to avoid retrying OpenAI SDK 4xx
