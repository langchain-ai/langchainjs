---
"@langchain/google": patch
---

Fix `ChatGoogle` so non-streaming results expose standard camelCase `llmOutput.tokenUsage` fields in callbacks and response metadata.
