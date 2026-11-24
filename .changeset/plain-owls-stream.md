---
"@langchain/openrouter": patch
---

Remove dead code from the `streamEvents` path

- `_streamChatModelEvents` read `options.streamUsage`, which no call-options
  type declares. The read was also dead: the constructor always sets
  `this.streamUsage` to a boolean (default `true`), so the per-call value was
  never consulted. It now reads `this.streamUsage` alone.
- The stream converter copied `delta.reasoning` into `delta.reasoning_content`,
  a field OpenRouter does not send in responses. The core converter already
  reads `reasoning_content ?? reasoning`, so the copy changed nothing and is
  removed.

No behaviour change.
