---
"@langchain/google": patch
---

fix(google): retry failed requests on the `streamEvents` path, as `invoke()` and `.stream()` do

`streamChatModelEvents()` in both the `generateContent` and `interactions` handlers called the API client directly, so a 429 or 503 before the stream started was never retried and never reached the caller's failed-attempt handling (a quota-style 429 also came back without its `rateLimitType`). The request now goes through the model's caller with the call's `signal` and `maxRetries` (and counts against `maxConcurrency`), as `generate()` and `streamResponseChunks()` do. `invoke()` takes this path when a callback handler consumes stream events, so it is fixed the same way.
