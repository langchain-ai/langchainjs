---
"@langchain/core": patch
---

feat(core): add `createSafeFetch` for fetching untrusted URLs, with DNS-pinned connections and checked redirects; `validateSafeUrl` now takes a policy (`allowedHosts`, `allowedSchemes`, ...) and recognizes more address forms
