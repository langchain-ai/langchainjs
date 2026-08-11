---
"langchain": patch
---

fix(langchain): exclude middleware-internal model calls from the message projection

Bookkeeping model calls made by `summarizationMiddleware` and `toolEmulatorMiddleware` no longer appear in `run.messages` or `stream({ streamMode: "messages" })`, and the summary `summarizationMiddleware` writes back to state is no longer projected as a new message. These calls remain observable via `streamEvents({ version: "v2" })`, identified by `lc_source`.
