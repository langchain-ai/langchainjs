---
"@langchain/groq": patch
---

Tighten the `@langchain/core` peer dependency to `^1.1.30`, the version that introduced the `utils/standard_schema` and `language_models/structured_output` export subpaths imported by `ChatGroq`. The previous `^1.0.0` range allowed core versions below 1.1.30 that lack these exports, causing module-not-found build failures.
