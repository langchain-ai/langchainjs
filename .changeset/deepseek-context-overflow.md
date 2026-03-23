---
"@langchain/openai": patch
---

fix(openai): detect DeepSeek context overflow errors as `ContextOverflowError`

DeepSeek returns `maximum context length` in 400 error messages when the context limit is exceeded. These are now recognized by `wrapOpenAIClientError`, so downstream code (e.g. summarization middleware fallback) can handle them correctly.
