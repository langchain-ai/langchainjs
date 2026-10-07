---
"langchain": patch
---

feat(agents): add opt-in `interruptMode: "per_call"` to `humanInTheLoopMiddleware`. Each gated tool call raises its own interrupt (`type: "tool_approval"`, with a typed `responseSchema` built from the tool's allowed decisions), answered by interrupt ID. Edits are pinned to the called tool and checked against its Zod v4 schema, and an invalid answer throws without being saved. Also adds `Interrupt.response_schema`. Batched mode is unchanged.
