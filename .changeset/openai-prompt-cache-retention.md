---
"@langchain/openai": patch
---

fix(openai): send `promptCacheRetention: "in-memory"` as `"in_memory"` (the API rejects the hyphenated value), and apply `promptCacheKey`/`promptCacheRetention` in the same order as `promptCacheOptions`: per-call option, then `modelKwargs`, then the constructor field. On Chat Completions, `modelKwargs` values are no longer dropped and now take precedence over the constructor field.
