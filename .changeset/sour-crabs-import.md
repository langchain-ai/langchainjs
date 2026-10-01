---
"@langchain/cohere": patch
---

Import Cohere SDK types from the package root

cohere-ai 8 ships an `exports` map that only exposes the package root, so the
published declarations for `CohereEmbeddings.embed()` imported `EmbedRequest`
from `cohere-ai/api/client/index.js`, a path consumers using `node16`,
`nodenext` or `bundler` resolution cannot resolve. The parameter is now typed
as `Cohere.EmbedRequest` from `cohere-ai`. Type-only; no runtime change.
