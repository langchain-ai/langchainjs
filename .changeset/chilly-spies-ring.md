---
"langchain": patch
---

feat(langchain): add `providerToolSearchMiddleware`

Adds `providerToolSearchMiddleware` - provider-side tool search for agents. `providerToolSearchMiddleware` enables API consumers to opt tools into tool deferral + discovery by providing tool instances/names to the middleware's `searchableTools` arg. `searchableTools` are marked as `defer_loading` in subsequent model requests, consumed by OpenAI and Anthopic to power their tool search systems.
