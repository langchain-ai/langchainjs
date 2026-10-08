---
"@langchain/xai": patch
---

Remove a dead `streamUsage` read from the `ChatXAIResponses` `streamEvents` path

`_streamChatModelEvents` read `options.streamUsage ?? true`, but
`ChatXAIResponses` has no `streamUsage` option: it isn't a call option, a
constructor param or a field. The read only ever saw `undefined`, so usage was
always streamed, as it is on the `.stream()` path. It is removed, along with the
internal stream converter's matching option, which nothing else passed.

No behaviour change.
