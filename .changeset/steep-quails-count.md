---
"@langchain/google": patch
---

Count thinking tokens in `streamEvents` usage, as `invoke()` and `.stream()` do

`ChatGoogle.streamEvents()` built its usage from Gemini's `promptTokenCount`,
`candidatesTokenCount` and `totalTokenCount` alone. `candidatesTokenCount`
leaves out thinking tokens, so with a thinking model `output_tokens` came out
lower than `invoke()` and `.stream()` report for the same response, and
`input_tokens + output_tokens` fell short of `total_tokens`. The usage also had
no token details. `streamEvents()` now uses the same conversion as the other
two paths: `output_tokens` includes `thoughtsTokenCount`,
`output_token_details.reasoning` carries it, and the details carry the
per-modality counts and `cache_read`. `invoke()` takes this path too when a
callback handler consumes stream events, so its `usage_metadata` is fixed the
same way. For a response with no thinking tokens the counts are unchanged; only
the details are added.
