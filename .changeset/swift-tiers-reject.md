---
"@langchain/openai": patch
---

Type `service_tier` like the constructor input, and reject `"ultrafast"` on Chat Completions

The constructor accepts the Responses API's service tiers, which include
`"ultrafast"`, but stored them in a `service_tier` property typed with the
Chat Completions tiers. The property now has the constructor input's type, so
reading `model.service_tier` can return `"ultrafast"`. Chat Completions has no
`"ultrafast"` tier, and `ChatOpenAICompletions` used to send it anyway; it now
throws a clear error asking for the Responses API instead. A per-call
`service_tier` still overrides the constructor's, and `ChatOpenAI` with the
Responses API sends `"ultrafast"` as before.
