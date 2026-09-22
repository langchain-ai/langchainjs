---
"@langchain/openai": patch
---

Declare `streamUsage` as a per-call option

`_streamResponseChunks` reads `options.streamUsage` in both the completions and
responses models, but no call-options interface declared it, so the per-call
override was unreachable from type-safe callers. It is now declared on
`BaseChatOpenAICallOptions`, which both derive from.

Additive and backward compatible — `stream_options` still takes precedence.
