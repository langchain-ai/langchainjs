---
"@langchain/google": patch
---

fix(@langchain/google): pass abort signal to fetch in non-streaming invoke
- Added `signal: options.signal` to the `Request` constructor in `_generate`'s non-streaming branch, mirroring what `_streamResponseChunks` already does
