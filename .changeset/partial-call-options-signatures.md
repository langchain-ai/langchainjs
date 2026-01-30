---
"@langchain/core": patch
---

fix(core): update method signatures to use `Partial<CallOptions>` for options parameters

Updated `invoke`, `stream`, `generate`, and `generatePrompt` method signatures across `Runnable`, `BaseChatModel`, and `BaseLLM` to correctly accept `Partial<CallOptions>` instead of full `CallOptions`. This aligns the implementation with the `RunnableInterface` specification and allows users to pass partial options (e.g., `{ signal: abortedSignal }`) without TypeScript errors.
