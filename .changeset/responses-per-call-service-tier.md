---
"@langchain/openai": patch
---

Honour a per-call `service_tier` on the Responses API. `ChatOpenAIResponses.invocationParams` read only the constructor value, so `model.invoke(input, { service_tier: "flex" })` was silently dropped when `useResponsesApi` was true, while the completions path applied it. The per-call value now takes precedence, with the constructor value as the fallback.
