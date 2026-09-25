---
"@langchain/google-genai": patch
---

Fix `@langchain/google-genai` structured output / tool schemas failing with a Gemini 400 (`Unknown name "exclusiveMinimum"`) when a Zod schema uses `.positive()`, `.negative()`, `.gt()`, or `.lt()`. These emit `exclusiveMinimum`/`exclusiveMaximum`, which Gemini's schema does not support; they are now remapped to the supported `minimum`/`maximum` keywords (mirroring `@langchain/google-common`).
