---
"@langchain/core": patch
---

`parseJsonMarkdown` no longer treats "```" inside JSON string values as a Markdown code fence. JSON whose strings contain a fenced code sample now parses in full, whether it is bare or wrapped in a code block, so `JsonOutputParser` and `StandardSchemaOutputParser` (used by `withStructuredOutput` with a JSON schema or a Standard Schema) no longer fail or return a truncated object on such output.
