---
"@langchain/google": patch
---

fix(google): fix inflated usage_metadata during streaming by converting cumulative token counts to deltas

The Gemini API sends cumulative `usageMetadata` on every streaming chunk. Previously, these cumulative values were attached directly to each `AIMessageChunk`, causing `mergeUsageMetadata()` to sum them and produce inflated token counts when chunks were concatenated.

Now the provider tracks previous cumulative values and emits per-chunk deltas, so additive merging produces the correct final totals while still providing meaningful per-chunk usage data when `streamUsage` is enabled.
