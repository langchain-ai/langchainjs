---
"@langchain/anthropic": patch
---

Fall back to `tool_calls` in `AnthropicToolsOutputParser` so `withStructuredOutput` works when streamed content is normalized to `tool_call` blocks
