---
"@langchain/openai": patch
---

Inline `$ref` sibling keywords in zod v4 interop response formats so OpenAI strict mode no longer rejects schemas where a field is chained `.default().describe()`
