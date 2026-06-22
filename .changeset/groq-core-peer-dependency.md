---
"@langchain/groq": patch
---

fix(groq): require `@langchain/core` >= 1.1.30 in peer dependency

The package imports `@langchain/core/utils/standard_schema` and
`@langchain/core/language_models/structured_output`, both of which were
introduced in `@langchain/core@1.1.30`. The previous `^1.0.0` peer
dependency range allowed installing incompatible older versions and
caused module-resolution failures at build/runtime.
