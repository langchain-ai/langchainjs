---
"@langchain/cloudflare": patch
---

fix(cloudflare): `CloudflareWorkersAIEmbeddings` now uses the `batchSize` passed to its constructor instead of always 50
