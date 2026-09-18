---
"@langchain/core": patch
---

Deliver callbacks once per handler instance when merged runnable configurations contain duplicate registrations. Preserve handler order and inheritance, including handlers registered both locally and as inheritable.
