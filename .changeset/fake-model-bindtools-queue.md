---
"@langchain/core": patch
---

fix(core): advance fakeModel response queue across bindTools calls

`bindTools()` created a new `FakeBuiltModel` that shared the response queue and call history by reference but copied `_callIndex` by value. Each bound instance kept its own cursor snapshot, so re-binding tools (as `createAgent` does on every model step) reset the cursor to the parent's snapshot and replayed the first queued response.

Derive the cursor from the shared `_calls` array length so every bound instance consumes responses in order.
