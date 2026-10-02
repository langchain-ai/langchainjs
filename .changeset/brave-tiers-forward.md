---
"@langchain/openai": patch
---

Send the per-call `service_tier` on the Responses API

`service_tier` is a call option on every OpenAI chat model, and Chat
Completions already used it, but Responses API requests sent only the
constructor's `service_tier` and dropped the per-call one. A per-call
`service_tier` now overrides the constructor's on both APIs. Calls that do not
set it are unchanged.
