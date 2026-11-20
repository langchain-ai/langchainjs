---
"@langchain/cloudflare": patch
---

fix(cloudflare): `CloudflareD1MessageHistory.clear()` no longer fails with `near "?": syntax error`; the table name was bound as a SQL parameter
