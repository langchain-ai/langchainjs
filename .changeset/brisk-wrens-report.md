---
"@langchain/anthropic": patch
---

Report `model_provider` on messages assembled from `streamEvents`

`streamEvents()` (and `invoke()` when a stream-event handler is attached) put
`model_provider: "anthropic"` on the `message-finish` event's `metadata`, a
field core never reads, so the assembled `AIMessage` had no
`response_metadata.model_provider`. Sent back to `ChatAnthropic`, such a message
lost its thinking blocks (with their signatures), server tool calls and results,
and other Anthropic-native blocks, since those are only converted for messages
from Anthropic. `model_provider` is now in the event's `responseMetadata`,
where other providers' converters put it.
