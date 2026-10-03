---
"@langchain/openai": patch
---

Fix a caller-supplied `User-Agent` being emitted as a second header. `getHeadersWithUserAgent` looked the caller's value up under `User-Agent`, but `normalizeHeaders` goes through `Headers`, which lowercases every name — so the lookup never matched, the caller's `user-agent` survived the spread beside the library's `User-Agent`, and the transport comma-joined the two. The caller's token is now appended after the library's, space separated, in a single header.
