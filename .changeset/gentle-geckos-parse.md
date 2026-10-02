---
"@langchain/google": patch
---

Fix type errors in `ChatGoogle`'s usage reads and error parsing

- The `streamEvents` converter fell back to a `usage_metadata` key when a
  response had no `usageMetadata`. Gemini and Vertex AI only send the
  camelCase key, and the package parses their JSON as is, so the fallback
  never matched and is removed.
- `_streamChatModelEvents` read `options.streamUsage`, which no call-options
  type declares. `streamUsage` is a constructor field, and `.stream()` already
  reads `this.streamUsage` alone, so `streamEvents` now does too. A per-call
  `streamUsage` passed without types, which `.stream()` never honoured, is no
  longer read by `streamEvents` either.
- With `streaming: true`, `invoke()` read `usage_metadata` from the merged
  chunk's `BaseMessageChunk`. It now reads it after an
  `AIMessageChunk.isInstance` check; the chunks are always AI chunks.
- `RequestError.fromResponse` and `AuthError.fromResponse` read the message
  from an error body typed `unknown`. They now take `error.message`,
  `message`, `error` or `error_description` only when that field is a string.
  Google's error bodies carry string messages, so those errors read as before;
  a body whose matching field isn't a string now gets the status-code message
  instead of one like `[object Object]`.
