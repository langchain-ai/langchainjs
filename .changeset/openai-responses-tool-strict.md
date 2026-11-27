---
"@langchain/openai": patch
---

Responses API function tools no longer serialize `strict: null` when no strict option is configured; they now default to `strict: false`, and a tool-level `function.strict` is preserved unless a global strict override is supplied. Chat Completions behavior is unchanged.
