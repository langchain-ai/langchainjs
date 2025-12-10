---
"@langchain/anthropic": minor
---

Expose `ChatAnthropicInput` type for improved type safety and user experience.

This change introduces a new exported type `ChatAnthropicInput` which is an intersection of `AnthropicInput` and `BaseChatModelParams`. This allows LangChain users to define and pass ChatAnthropic configuration options with full type safety and IntelliSense.
