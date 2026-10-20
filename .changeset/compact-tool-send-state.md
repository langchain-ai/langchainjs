---
"langchain": patch
---

Avoid copying full agent state into every parallel tool task. Restore tool and middleware state from graph channels for compact tasks while continuing to support full-state tasks saved in older checkpoints.
