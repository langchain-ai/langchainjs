---
"@langchain/openai": patch
---

Fix `content.findIndex is not a function` error when `AIMessage` has string content in `convertMessagesToResponsesInput` phase extraction.
