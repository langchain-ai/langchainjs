---
"@langchain/typesafe": patch
---

Reject a cyclic `state`, `criteria` or `instructions` with the package's content-free errors on every zod 4 version. From zod 4.5 a cycle no longer overflowed the parse, so it reached `JSON.stringify`, whose error names the offending key.
