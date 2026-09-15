---
"@langchain/mcp-adapters": patch
---

Separate tool argument preparation, per-call header selection, and result handling.
Preserve hook behavior, validation errors, logging metadata, and cancellation.
Parse effective tool arguments with the SDK validator and preserve Zod error causes.
Handle progress callback rejections without failing completed tool calls.
