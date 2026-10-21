---
"@langchain/google": patch
---

feat(google): support Long Decode continuation tokens for Generate Content

- Pass `continuationToken` as a call option to resume a Long Decode request; read the next token from `response_metadata.continuationToken`. Continuation is never automatic.
- Streaming emits only the latest checkpoint token, once, so aggregated chunks hold a valid token.
- Continuation tokens passed in are kept out of traced invocation params and redacted from traced call options.
- Stream events report `CONTINUATION` as finish reason `length`; when a token is returned, `response_metadata` also carries it and Google's raw `finishReason`.
- Add a configurable `timeout`. When unset, requests with `maxOutputTokens` above 64,000 get 20 minutes and other requests keep `fetch`'s default behavior; `0` disables it.
- Regenerate the Generate Content API types from the latest OpenAPI spec, which includes `continuationToken`.
