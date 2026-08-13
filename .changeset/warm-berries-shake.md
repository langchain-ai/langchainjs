---
"@langchain/fireworks": patch
---

fix(fireworks): stop retrying deterministic embeddings failures

`FireworksEmbeddings` threw errors with the HTTP status buried in the message text, so nothing downstream could act on it and a bad API key was retried to exhaustion on every embed call. The status is now available on the error, and failures are marked retryable or not using `stampRetryable` from `@langchain/core`. Error messages are unchanged.

`ChatFireworks` and `Fireworks` already inherit marking from `@langchain/openai`.

Also forwards a per-call `maxRetries` to the retry loop, so a surrounding retry loop such as `modelRetryMiddleware` can take over instead of the two multiplying against each other.

The `@langchain/core` peer range moves from `^1.0.0` to `workspace:^`, since this release depends on `stampRetryable`.
