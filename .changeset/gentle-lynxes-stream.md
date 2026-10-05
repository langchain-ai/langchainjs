---
"@langchain/classic": patch
---

Return a `ChatModelStream` from `initChatModel` models' `streamEvents()` without a version

`BaseChatModel.streamEvents()` without a `version` returns a
`ChatModelStream` (awaitable, with `.text`, `.toolCalls`, `.reasoning` and
`.usage`), but the `ConfigurableModel` that `initChatModel` returns only
handled `version: "v1" | "v2"`. Called without a version, it, and the
inherited `streamV2()`, returned a plain `ReadableStream` of the configured
model's events instead. It now returns a `ChatModelStream` over the
configured model's `streamEvents()`, as `langchain`'s `initChatModel` does.
Calls with a `version` behave as before.
