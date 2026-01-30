---
"@langchain/openai": patch
---

Add `reasoningEffort` call option as a convenience shorthand for `reasoning.effort`

- Adds `reasoningEffort` to `BaseChatOpenAICallOptions` for easier configuration of reasoning models
- Automatically coalesces `reasoningEffort` into `reasoning.effort` when calling reasoning models (o1, o3, etc.)
- If both `reasoningEffort` and `reasoning.effort` are provided, `reasoning.effort` takes precedence
- Marked as `@deprecated` to encourage use of the full `reasoning.effort` option
