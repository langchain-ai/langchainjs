---
"@langchain/google-common": patch
---

fix(google-common): surface actual API error when GAuthClient's gaxios throws for non-2xx responses

Previously, when `GAuthClient._fetch` (via `google-auth-library`/gaxios) threw a `GaxiosError` for non-2xx
responses, the error bypassed `_request()`'s `!res.ok` formatting and propagated with an empty/undefined
message. Users saw "undefined" in their traces instead of the actual Google API error. This was particularly
impactful for `image_url`/`fileData` content where Gemini returns descriptive errors like
"Cannot fetch content from the provided URL" when it can't access the image.

The fix wraps `_fetch()` in a try/catch that extracts the status and response body from the thrown error and
re-throws with the same well-formatted message used by the existing `!res.ok` path. Both paths now funnel
through a shared `_throwRequestError()` helper.
