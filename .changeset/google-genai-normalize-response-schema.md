---
"@langchain/google-genai": patch
---

fix(google-genai): normalize `responseSchema` through `schemaToGenerativeAIParameters` in `invocationParams` so agents passing raw Zod / JSON schemas (e.g. `createAgent({ responseFormat: providerStrategy(zodSchema) })`) no longer send `additionalProperties`/`$schema` fields that the Gemini API rejects with `Invalid JSON payload received`.
