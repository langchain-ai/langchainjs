---
"@langchain/openai": patch
---

fix(openai): keep scalar `response_metadata` fields last-wins when a provider emits multiple `finish_reason` chunks

`ChatOpenAI` completions streaming attaches `finish_reason`, `model_name`, `system_fingerprint`, and `service_tier` to every finish-reason chunk. `AIMessageChunk.concat` string-concatenates these scalar fields, so OpenAI-compatible providers that emit more than one finish-reason chunk (e.g. OpenRouter) produced corrupted metadata such as `finish_reason: "stopstop"` and a doubled `model_name`. These fields are now treated as last-wins on merge. Numeric `usage_metadata` summing is unchanged.
