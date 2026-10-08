---
"langchain": patch
---

feat(agents): add opt-in `interruptMode: "per_call"` to `humanInTheLoopMiddleware`. Each gated tool call raises its own interrupt (`type: "tool_approval"`, with a typed `responseSchema` built from the tool's allowed decisions), answered by interrupt ID. Edits are pinned to the called tool and checked against the input side of its Zod v4 schema, so its transforms run once, when the tool does. An invalid answer throws without being saved. Also adds `Interrupt.response_schema`. Batched mode is unchanged.
