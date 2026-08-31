---
"@langchain/openrouter": patch
---

fix(openrouter): surface OpenRouter's top-level `provider` field in `response_metadata`

OpenRouter's non-streaming chat completions response includes a top-level
`provider` field naming the upstream that actually served the request (e.g.
`"DigitalOcean"`). `convertOpenRouterResponseToBaseMessage` never read it, so
`response_metadata` exposed only the hardcoded `model_provider: "openrouter"`
and callers had no per-call way to tell which upstream answered. The field is
now copied through when present, matching the Python `langchain-openrouter`
package which sets `response_metadata["provider"]` in `_create_chat_result`.
