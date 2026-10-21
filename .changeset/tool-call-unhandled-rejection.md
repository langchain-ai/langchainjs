---
"langchain": patch
---

Fix unhandled promise rejection when a tool throws during `streamEvents({ version: "v3" })` and the consumer does not await `call.output`. The native `ToolCallTransformer` now attaches a no-op handler to each tool call's `output` promise (mirroring `GraphRunStream`), so a rejected output stays observable for consumers that await it without crashing those that don't.
