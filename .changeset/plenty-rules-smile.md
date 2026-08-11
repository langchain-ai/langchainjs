---
"langchain": minor
---

fix(langchain): exclude middleware-internal model calls from the message stream

`summarizationMiddleware` and `toolEmulatorMiddleware` make bookkeeping model calls that are not part of the agent's conversation. These were indistinguishable from the agent's main model call, so they surfaced as extra assistant messages in `run.messages` and in `stream({ streamMode: "messages" })`. They are now tagged so LangGraph's messages handler skips them.

`llmToolSelectorMiddleware` is tagged for consistency, but its internal call was already isolated from these streams — its behavior is unchanged.

**Behavior change:** if you relied on seeing the summarization or tool-emulation calls in `run.messages` or `stream({ streamMode: "messages" })`, they no longer appear there. They remain observable via Core's event stream, identified by `lc_source`:

```ts
for await (const event of agent.streamEvents(input, { version: "v2" })) {
  if (event.event !== "on_chat_model_end") continue;
  if (event.metadata?.lc_source === "summarization") {
    // the internal summarization call
  }
}
```

`lc_source` is `"summarization"` or `"toolEmulation"`. Custom callback handlers and LangSmith tracing are unaffected.
