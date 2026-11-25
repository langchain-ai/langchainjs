---
"@langchain/core": patch
---

fix(core): include nested metadata in the indexing API's document hash

`index()` hashed metadata with `JSON.stringify(data, Object.keys(data).sort())`, and an array replacer is an allowlist at every depth, so the keys of nested objects were dropped. Documents that differed only in nested metadata (for example `loc.lines` from a text splitter, or `{ info: { author } }`) got the same id: a change to nested metadata was counted as skipped and the vector store kept the old metadata. Nested keys are now part of the hash. Hashes of flat metadata are unchanged.
