---
"@langchain/google-genai": patch
---

fix(google-genai): rewrite JSON Schema list-valued `type` (e.g. `["string","null"]` from Zod 3 `.nullable()`) into Gemini's single-valued `type` plus `nullable` before sending `responseSchema`
