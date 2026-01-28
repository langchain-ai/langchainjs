---
"langchain": patch
---

Fix OOM memory leak in initChatModel by excluding internal keys from cache.
