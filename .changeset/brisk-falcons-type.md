---
"@langchain/groq": patch
---

Fix `ChatGroq`'s type errors against groq-sdk 1.x

`completionWithRetry` typed its request options as `RequestOptions` from
`groq-sdk/core`, a path groq-sdk 1.x no longer exports, so the published
declarations imported a module that doesn't resolve: projects that check
library types got TS2307, and the rest saw the options as `any`. They are now
`Groq.RequestOptions`, which groq-sdk exports from its client. The import was
type-only, so the JavaScript is unchanged.
