---
"langchain": minor
---

fix(langchain): exclude middleware-internal model calls from the message stream

`summarizationMiddleware`, `toolEmulatorMiddleware`, and `llmToolSelectorMiddleware` make bookkeeping model calls that are not part of the agent's conversation. These were indistinguishable from the agent's main model call, so they surfaced as extra assistant messages in `run.messages` and in `stream({ streamMode: "messages" })`.

These calls are now tagged so LangGraph's messages handler skips them.

**Behavior change:** if you relied on seeing these internal calls in `run.messages` or `stream({ streamMode: "messages" })`, they no longer appear there. They remain fully observable via Core's event stream, tagged with `lc_source`:

```ts
for await (const event of agent.streamEvents(input, { version: "v2" })) {
  if (event.event !== "on_chat_model_end") continue;
  if (event.metadata?.lc_source === "summarization") {
    // the internal summarization call
  }
}
```

`lc_source` is `"summarization"`, `"toolEmulation"`, or `"llmToolSelector"`. Custom callback handlers and LangSmith tracing are unaffected.
