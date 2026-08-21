---
"@langchain/mcp-adapters": patch
---

Drop MCP tool JSON-schema regex patterns that fail to compile under the `u` flag. Such patterns (e.g. Annex B identity escapes like `\:`) are valid in a plain `RegExp` but throw a `SyntaxError` under the `u` flag that `@cfworker/json-schema` uses, which previously made every invocation of the tool fail.
