---
"@langchain/core": patch
---

feat(core): read `tool-call-delta` in `ChatModelStream`

- `ChatModelStream` appends `tool-call-delta` slices to a tool call's args, and still replaces them on `block-delta`
- It ignores delta types it doesn't recognize instead of throwing `Unknown delta type`
