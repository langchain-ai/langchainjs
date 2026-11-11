---
"@langchain/google-common": patch
---

Reject a streaming response when its body fails part-way, instead of leaving `nextChunk()` pending and raising an unhandled rejection.
