---
"@langchain/core": minor
"langchain": minor
---

feat(core): mark errors as retryable or not, and stop retrying the ones that aren't

Retry middleware retried every failure up to `maxRetries`, including deterministic ones like a bad API key or an unknown model. Worse, the two retry layers multiply: `AsyncCaller` defaults to 7 attempts and `modelRetryMiddleware` to 3, so a single unclassified failure could cost 21 API calls.

`@langchain/core/errors` adds two functions:

```ts
import { stampRetryable, getRetryable } from "@langchain/core/errors";

if (e.status === 429) throw stampRetryable(e, true);
if (e.status === 401) throw stampRetryable(e, false);

getRetryable(error); // true | false | undefined
```

The mark is a non-enumerable symbol set on the error itself, so a provider SDK error can be marked in place without changing its class — `instanceof` is unaffected. `getRetryable` returns `undefined` for unclassified errors. It is exported, so tool authors can classify their own failures too.

`modelRetryMiddleware` and `toolRetryMiddleware` now default to `retryOn: (error) => getRetryable(error) ?? true`. `AsyncCaller` also stops retrying once it sees an error already marked non-retryable, so a verdict reached inside the call — a provider's dispatcher, or a tool — takes effect on the first failure rather than after both retry budgets are spent. `413 Payload Too Large` joins its non-retryable status list, since resending identical bytes cannot succeed. `ModelAbortError` and `ContextOverflowError` are marked at construction.

**Behavior change:** errors marked non-retryable now fail on the first attempt. Unclassified errors — including any from third-party integrations or custom tools — retry exactly as before. Pass `retryOn: () => true` to restore the old default. A custom `onFailedAttempt` replaces `AsyncCaller`'s handler and opts out of its marking.
