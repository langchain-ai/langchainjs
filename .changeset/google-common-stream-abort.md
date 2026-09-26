---
"@langchain/google-common": patch
---

Aborting a streamed request mid-response (for example with `AbortSignal.timeout`)
no longer leaves an unhandled promise rejection that crashes Node, and no longer
leaves the pending `nextChunk()` unsettled. The read error now rejects the pending
chunk, so it reaches the caller.
