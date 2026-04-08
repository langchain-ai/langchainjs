---
"@langchain/google-genai": patch
---

fix(@langchain/google-genai): pass abort signal to fetch in non-streaming invoke
- Added `options` as second argument to `completionWithRetry()` in `_generate`'s non-streaming branch, mirroring what `_streamResponseChunks` already does
