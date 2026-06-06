---
"langchain": patch
---

fix(agents): prevent unhandled promise rejection on HITL interrupts in `createToolCallTransformer`

When a Human-In-The-Loop interrupt arrives via a `tool-error` event, the `output` promise for the affected tool call was rejected before any consumer could attach a `.catch()` handler, causing a fatal `unhandledRejection` crash. The fix adds detection for HITL interrupt payloads (those whose serialised value contains an `actionRequests` array) and skips the rejection, keeping the tool call pending — consistent with the existing handling for headless tool interrupts.
