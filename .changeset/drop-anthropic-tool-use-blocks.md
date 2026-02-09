---
"@langchain/openai": patch
---

fix(openai): drop Anthropic `tool_use` content blocks when converting messages for OpenAI

When messages originating from Anthropic (e.g. via `ChatAnthropic`) are passed to `ChatOpenAI`, Anthropic-native `tool_use` blocks in `message.content` are now filtered out during conversion. These blocks are already represented in `message.tool_calls` and would cause an OpenAI API error if passed through.
