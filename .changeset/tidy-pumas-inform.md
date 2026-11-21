---
"@langchain/openrouter": patch
---

fix(openrouter): set `response_metadata.model_name` on streamed responses

Streamed chunks only carried `model_provider`, so an aggregated streamed reply had no `model_name` even though `invoke()` sets it. The served model is now stamped on the first chunk that reports it, once per stream so `_mergeDicts` cannot concatenate it into a duplicated string. This also covers `invoke()` on a callback that sets `lc_prefer_streaming`.
