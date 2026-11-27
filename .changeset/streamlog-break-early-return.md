---
"@langchain/core": patch
---

Fix breaking out of `streamLog()` / `streamEvents({ version: "v1" })` hanging forever: the log producer now stops when the consumer stops reading instead of blocking on backpressured writes.
