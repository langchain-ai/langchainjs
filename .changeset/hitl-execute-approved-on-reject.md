---
"langchain": patch
---

feat(agents): Add `executeApprovedOnReject` option to HITL middleware

When enabled, approved/edited tool calls in a batch continue to execution even if other calls in the same batch are rejected. Rejected calls produce `ToolMessage` with `status: "error"` while approved calls proceed normally. Defaults to `false` to preserve existing behavior.
