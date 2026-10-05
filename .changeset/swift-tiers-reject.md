---
"@langchain/openai": patch
---

Type `service_tier` like the constructor input, and route `"ultrafast"` to the Responses API

The constructor accepts the Responses API's service tiers, which include
`"ultrafast"`, but stored them in a `service_tier` property typed with the
Chat Completions tiers. The property now has the constructor input's type, so
reading `model.service_tier` can return `"ultrafast"`.

`ChatOpenAI` sends `"ultrafast"` through the Responses API, switching to it
automatically as it does for other Responses-only options.
`ChatOpenAICompletions` used directly throws a clear error for `"ultrafast"`,
because Chat Completions has no such tier.
