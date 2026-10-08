---
"langchain": patch
---

fix(langchain): `createAgent` with middleware now passes a `Command` built by a different copy of `@langchain/langgraph` to the graph as-is, instead of merging it into the input state as a plain object.
