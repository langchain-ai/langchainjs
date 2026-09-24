---
"langchain": patch
---

fix(agents): `jumpTo: "model"` now resolves to the top of the agent loop

A middleware hook returning `jumpTo: "model"` now lands on the first `beforeModel` node (or the model request node when no middleware defines a `beforeModel` hook), from every hook type — `beforeAgent`, `beforeModel`, `afterModel` and `afterAgent`. It previously went straight to the model request node, silently skipping every `beforeModel` hook, so summarization, context editing, model-call limits, guardrails and dynamic prompts did not run on the retry turn. This affects the built-in human-in-the-loop middleware, which jumps to `"model"` after a rejected tool call.

An explicit jump from `afterModel` is also honoured when the model replied without tool calls — previously the run ended instead, and whether the jump took effect depended on where the middleware sat in the list.

This matches the documented behaviour and the Python SDK. If you relied on a jump skipping your `beforeModel` work, make that explicit with your own state flag read by the hook.
