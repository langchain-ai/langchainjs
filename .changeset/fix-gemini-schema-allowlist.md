---
"@langchain/google": patch
---

fix: allowlist JSON Schema keywords for Gemini function/response schemas instead of denylisting, fixing `propertyNames`/`exclusiveMinimum`/etc. 400s (#8584)
