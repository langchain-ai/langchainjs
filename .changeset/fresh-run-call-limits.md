---
"langchain": patch
---

agents: keep run-level call limit counters out of the checkpoint in `modelCallLimitMiddleware` and `toolCallLimitMiddleware`. Run counts are scoped to a single run, but they were previously persisted as regular state. When a run ended without the `afterAgent` reset (run failure or the limit itself jumping to the end), the stale count leaked into the next run on the same thread and falsely tripped the run limit, losing that run's answer. Run-level counters are now untracked (transient) state, matching the Python implementation, so every run starts with a fresh count.
