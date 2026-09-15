---
"langchain": patch
---

Preserve LangGraph interrupts in `toolRetryMiddleware` instead of retrying them or converting them into tool errors. Interrupted tool calls can pause and resume through their checkpointer without being treated as failures.
