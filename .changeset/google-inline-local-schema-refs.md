---
"@langchain/google": patch
---

fix(google): inline local `$ref`s in tool and structured output schemas

JSON Schemas with local references (`$defs` in JSON Schema 2020-12, `definitions` in draft-07), such as MCP tool input schemas, are now inlined before being sent to Gemini instead of throwing. Recursive and non-local references still throw.
