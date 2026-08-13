---
"@langchain/fireworks": minor
---

fix(fireworks): stop retrying deterministic embeddings failures

`FireworksEmbeddings` threw errors with the HTTP status buried in the message text, so nothing downstream could act on it and a bad API key was retried to exhaustion on every embed call. The status is now available on the error, and failures are marked retryable or not using `stampRetryable` from `@langchain/core`. Error messages are unchanged.

`ChatFireworks` and `Fireworks` are unchanged; they already inherit marking from `@langchain/openai`.

The `@langchain/core` peer range moves from `^1.0.0` to `workspace:^`, since this release depends on `stampRetryable`.
