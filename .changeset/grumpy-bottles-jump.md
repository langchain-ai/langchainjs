---
"@langchain/openai": patch
---

Preserve scalar response metadata when streaming providers emit repeated finish chunks. Keep the latest defined finish reason, model, fingerprint and service tier instead of concatenating their strings.
