---
"langchain": patch
---

feat(langchain): register stream transformers on middleware

`createMiddleware` accepts `streamTransformers` factories that are merged with
`createAgent({ streamTransformers })` at compile time. Types flow through
`CombineStreamTransformers` so `run.extensions` is inferred from both sources.
