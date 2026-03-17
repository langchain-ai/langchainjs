---
"langchain": patch
---

fix(langchain/agents): dispatch tool calls via Send in afterModel router for version:"v2"

**Breaking change for `version: "v2"` + `afterModel` middleware users.**

Previously, when `afterModel` middleware was present, `createAgent` always routed all tool calls from an `AIMessage` to a single `ToolNode` invocation — regardless of the `version` option. This meant `version: "v2"` silently behaved like `version: "v1"` (parallel via `Promise.all` in one node) whenever `afterModel` middleware was used.

`#createAfterModelRouter` now correctly respects `#toolBehaviorVersion`:

- `version: "v1"` — routes the full `AIMessage` to a single `ToolNode` invocation; all tool calls run concurrently via `Promise.all` (unchanged behaviour).
- `version: "v2"` — dispatches each tool call as a separate `Send` task, matching the behaviour of `#createModelRouter` when no `afterModel` middleware is present, and matching Python LangGraph's `post_model_hook_router`.

**Migration:** If you use `version: "v2"` (the default) together with `afterModel` middleware and rely on the previous single-node parallel execution, switch to `version: "v1"` to preserve that behaviour. See the `version` JSDoc on `CreateAgentParams` for guidance on which option to choose.
