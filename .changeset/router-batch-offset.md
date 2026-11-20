---
"@langchain/core": patch
---

Fix RouterRunnable.batch to preserve each input's route and configuration under concurrency limits and return per-input errors when returnExceptions is enabled.
