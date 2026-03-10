---
"@langchain/core": patch
---

fix(core): treat empty string tool call chunk IDs as missing during merge

Fixed `_mergeLists` in message base to treat empty string `""` IDs the same as `null`/`undefined` when merging tool call chunks. This fixes old completions-style streaming where follow-up chunks carry `id: ""` instead of `undefined`, which previously prevented chunks from being merged by index.
