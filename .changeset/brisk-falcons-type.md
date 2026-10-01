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

The constructor's first argument is now required in its implementation too, as
both public overloads already require it. The `{}` fallback it replaces built a
`ChatGroq` whose `model` was `undefined` when called with no arguments from
JavaScript; such a call now throws a `TypeError` from the base class
constructor, as it did before the string shorthand was added. Calls that match
an overload behave as before.

The `httpAgent` field is no longer passed to the groq-sdk client. groq-sdk 1.x
dropped that client option and ignores it, so `httpAgent` has had no effect
since `@langchain/groq` 1.2.0 moved to groq-sdk 1.x; requests use the `fetch`
implementation, which the `fetch` field can still replace.
