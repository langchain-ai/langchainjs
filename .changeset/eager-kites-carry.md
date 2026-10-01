---
"@langchain/anthropic": patch
---

Report context management edits when streaming

With `contextManagement` set, the API reports the edits it applied in the
`message_delta` event's `context_management` field, but both streaming paths
looked for it inside the event's `delta`, where the API never sends it. So
`.stream()` (and `invoke()` with `streaming: true`) never set
`response_metadata.context_management`, and `streamEvents()` never emitted its
`context_management` provider event. Both now read the event's own field, as
non-streaming `invoke()` already did through the response's
`context_management`.
