---
"@langchain/core": patch
"@langchain/community": patch
---

feat(core): Add SSRF protection module (`@langchain/core/utils/ssrf`) with utilities for validating URLs against private IPs, cloud metadata endpoints, and localhost.

fix(community): Harden `RecursiveUrlLoader` against SSRF attacks by integrating `validateSafeUrl` and replacing string-based URL comparison with origin-based `isSameOrigin` from the shared SSRF module.
