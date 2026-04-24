---
"@langchain/core": patch
---

fix(core): advance fakeModel response queue across repeated bindTools() calls

`FakeBuiltModel.bindTools()` copied the call-index counter by value, so a
second `bindTools()` on the same base model produced a clone that reset the
response queue to index 0. In flows like `createAgent`, which re-bind tools
on every model step, this silently returned the first queued response for
every step instead of walking through the queue.

The per-instance counter is now derived from the shared `_calls` array, so
all clones stay in sync with the base model.
