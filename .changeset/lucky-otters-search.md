---
"@langchain/exa": minor
---

feat(exa): upgrade to exa-js 2.x and add Contents, Answer, and Agent tools. `ExaFindSimilarResults` remains available but is deprecated in favor of `ExaSearchResults`. Legacy top-level content options in `searchArgs` (e.g. `text`, `highlights`) are still accepted and nested under `contents` automatically.
