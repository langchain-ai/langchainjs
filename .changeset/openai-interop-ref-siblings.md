---
"@langchain/openai": patch
---

fix(openai): inline $defs targets into $ref nodes that carry sibling keywords in interopZodResponseFormat, so zod v4 fields chained .default().describe() no longer make OpenAI strict mode reject the request with 400 "$ref cannot have keywords"
