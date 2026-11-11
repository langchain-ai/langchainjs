---
"langchain": patch
---

Avoid re-emitting untouched state from middleware lifecycle hooks that return partial or empty updates, preventing duplicate values in reducer-backed state channels.
