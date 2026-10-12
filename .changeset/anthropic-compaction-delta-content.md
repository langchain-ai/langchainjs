---
"@langchain/anthropic": patch
---

fix(anthropic): merge a streamed `compaction_delta` into the compaction block's `content` and `encrypted_content` instead of nesting it under a `compaction` key, so the block replayed on the next request is accepted by the API.
