---
"@langchain/openai": patch
---

fix(openai): honour the per-call `service_tier` in the Responses API

A `service_tier` passed as a call option was silently dropped when `useResponsesApi` was enabled; only
the value set on the instance reached the request.
