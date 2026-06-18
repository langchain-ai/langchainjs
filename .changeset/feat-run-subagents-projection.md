---
"langchain": minor
---

feat(langchain): surface tool-dispatched subagents on `run.subagents`

Add a native subagent stream transformer to `createAgent` so v3 runs expose
named nested agents (`createAgent({ name })` invoked from tools) as typed
`SubagentRunStream` handles with `name`, `cause`, scoped `messages` /
`toolCalls`, and `output`. Refactors agent stream transformers into
`agents/transformers/` and exports only the public stream types from the
package entry.
