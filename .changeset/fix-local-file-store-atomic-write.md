---
"langchain": patch
---

Use atomic write (temp file + rename) in LocalFileStore to prevent file corruption from concurrent mset calls to the same key.