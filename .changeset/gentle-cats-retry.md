---
"@langchain/core": patch
---

Allow callers to configure HTTP status codes that should be retried when a gateway uses a normally non-retryable status for a transient upstream failure. Fixes #11573.
