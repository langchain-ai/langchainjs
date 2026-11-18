---
"@langchain/core": patch
"langchain": patch
---

Mark tool messages that `humanInTheLoopMiddleware` creates for `reject` and `respond` decisions with `lc_source: "human_in_the_loop"` and `lc_data: { decision }`, and let `addNotificationMetadata` accept tool messages
