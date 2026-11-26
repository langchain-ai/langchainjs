---
"@langchain/openai": patch
---

Fix `ChatOpenAI.withConfig` (and so `bindTools` / `withStructuredOutput`) returning a plain `ChatOpenAI` and dropping subclasses.
