---
"@langchain/openai": patch
---

Merge a caller-supplied `User-Agent` into the library user agent instead of emitting two headers. `normalizeHeaders` lowercases header names, so the existing lookup for `User-Agent` never matched and the caller's value was left in the result under `user-agent` alongside the library's `User-Agent`. Transports collapse those into a single comma-joined value, which is not valid `User-Agent` syntax. The two values are now combined into one space-separated header, affecting both OpenAI and Azure OpenAI chat models, embeddings, and LLMs.
