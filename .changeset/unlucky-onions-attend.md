---
"@langchain/core": minor
"langchain": minor
---

feat: add custom Vitest matchers for LangChain message and tool call assertions

Adds a new `@langchain/core/testing/matchers` export containing custom Vitest matchers (`toBeHumanMessage`, `toBeAIMessage`, `toBeSystemMessage`, `toBeToolMessage`, `toHaveToolCalls`, `toHaveToolCallCount`, `toContainToolCall`, `toHaveToolMessages`, `toHaveBeenInterrupted`, `toHaveStructuredResponse`) that external users can register via `expect.extend(langchainMatchers)` in their Vitest setup files. Re-exported from `langchain` for convenience.
