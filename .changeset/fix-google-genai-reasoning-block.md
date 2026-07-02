---
"@langchain/google-genai": patch
---

fix(google-genai): emit standard `reasoning` content blocks (instead
of `thinking`) for Gemini thoughts so output matches the LangChain
core ContentBlock.Reasoning shape used by all other providers. The
inbound conversion still accepts legacy `thinking` blocks for
backwards compatibility with previously-serialized messages.
