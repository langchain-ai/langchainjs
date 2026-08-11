---
"@langchain/core": minor
"langchain": minor
"@langchain/google": minor
"@langchain/openai": patch
"@langchain/anthropic": patch
"@langchain/fireworks": minor
---

feat(core): mark errors as retryable or not, and stop retrying the ones that aren't

Retry middleware retried every failure up to `maxRetries`, including deterministic ones like a bad API key or an unknown model.

`@langchain/core/errors` adds two functions:

```ts
import { stampRetryable, getRetryable } from "@langchain/core/errors";

if (e.status === 429) throw stampRetryable(e, true);
if (e.status === 401) throw stampRetryable(e, false);

getRetryable(error); // true | false | undefined
```

The mark is a non-enumerable symbol set on the error itself, so a provider SDK error can be marked in place without changing its class — `instanceof` is unaffected. `getRetryable` returns `undefined` for unclassified errors and follows the `.cause` chain. It is exported, so tool authors can classify their own failures too.

`modelRetryMiddleware` and `toolRetryMiddleware` now default to `retryOn: (error) => getRetryable(error) ?? true`. `ModelAbortError` and `ContextOverflowError` are marked at construction, and `AsyncCaller` marks what it already classifies. Google, OpenAI, Anthropic, and Fireworks mark the errors their dispatchers already recognize; `FireworksEmbeddings` also exposes the HTTP status as a field instead of only inside the message string, which had hidden it from every retry layer.

`@langchain/google` and `@langchain/fireworks` move their `@langchain/core` peer range to `workspace:^`.

**Behavior change:** errors marked non-retryable now fail on the first attempt. Unclassified errors — including any from third-party integrations or custom tools — retry exactly as before. Pass `retryOn: () => true` to restore the old default. A custom `onFailedAttempt` replaces `AsyncCaller`'s handler and opts out of its marking.
