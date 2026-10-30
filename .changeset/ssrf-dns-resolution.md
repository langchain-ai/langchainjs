---
"@langchain/core": patch
---

feat(core): add `validateSafeUrlAsync` and `isSafeUrlAsync` to `@langchain/core/utils/ssrf`. They run the existing static checks, then resolve the hostname with DNS and reject it if any address is private, loopback or cloud metadata. The sync `validateSafeUrl` and `isSafeUrl` are unchanged.
