---
"langchain": patch
---

Type `wrapModelCall` hooks so they can return `{ structuredResponse, messages }`, the shape the agent already accepts at runtime. Exports `WrapModelCallStructuredResponse`.
