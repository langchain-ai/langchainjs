---
"langchain": patch
---

`createAgent` no longer ends the run when a `returnDirect` tool fails. A tool error, including arguments that fail the tool's schema, now goes back to the model so it can correct the call and retry; the run still ends on the first successful `returnDirect` result. Error `ToolMessage`s produced by the tool node now carry `status: "error"`, and a `ToolMessage` returned from a custom `handleToolErrors` function defaults to that status when it sets none.
