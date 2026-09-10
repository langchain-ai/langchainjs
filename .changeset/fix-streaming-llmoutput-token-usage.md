---
"@langchain/core": patch
"@langchain/google": patch
---

fix(core): build streaming `llmOutput.tokenUsage` from the fully-accumulated chunk instead of whichever individual chunk's `usage_metadata` arrived last

Affects both core streaming paths — `.stream()`/`.streamEvents()` (`_streamIterator`) and `.invoke()`/`.generate()` when a streaming-preferring callback is attached (`_generateWithCache`'s `hasStreamingHandler` branch). Previously, `llmOutput.tokenUsage` was overwritten by each chunk in turn, so only the last chunk carrying `usage_metadata` won — correct for providers that emit one cumulative total on a final chunk, but wrong for providers (e.g. `@langchain/google`, `@langchain/anthropic`) that emit `usage_metadata` as a per-chunk delta across multiple chunks, where the values must be summed.

Note for provider authors: this assumes each streamed chunk's `usage_metadata` is either a per-chunk delta or appears only on a single final chunk. A provider that instead repeats a cumulative total on every chunk will now see it summed (and inflated) in `llmOutput.tokenUsage`, matching the existing behavior of the correctly-working `message.usage_metadata` field.

Also fixes `@langchain/google`'s `invoke({streaming: true})` path (no streaming-preferring callback attached), where `llmOutput` was never populated at all.
