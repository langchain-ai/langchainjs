---
"@langchain/deepseek": patch
---

Fall back to JSON mode for `withStructuredOutput` on reasoning models (`deepseek-v4-pro` / `deepseek-v4-flash` / `deepseek-reasoner`) instead of sending `tool_choice`, which DeepSeek rejects in thinking mode with a 400
