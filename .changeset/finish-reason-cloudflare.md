---
"@langchain/cloudflare": patch
---

Stop reporting a `stop` finish reason on `message-finish`, since Cloudflare sends no finish info.
