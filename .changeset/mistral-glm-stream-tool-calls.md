---
"@langchain/mistralai": patch
---

fix(mistralai): correctly merge GLM streamed tool calls

Preserve tool-call indexes from streamed Mistral responses and normalize placeholder IDs such as `"null"` to prevent GLM tool-call fragments from being merged incorrectly. Also add support for the `parallel_tool_calls` call option.
