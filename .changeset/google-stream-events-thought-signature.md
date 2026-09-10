---
"@langchain/core": patch
"@langchain/google": patch
---

fix(google): preserve tool call `id` and `thoughtSignature` in native stream events

`@langchain/google`'s `streamEvents()` path (`convertGoogleGeminiStream`) dropped both the tool call `id` and Gemini's `thoughtSignature` on every streamed function call, causing replayed tool calls to be rejected by Gemini 3 models with "missing a thought_signature" (#9624) and breaking tool-call correlation (#11261). Also widens `AIMessage`'s content-block/tool_calls sync in `@langchain/core` to carry `thoughtSignature` through, since it's needed on `tool_calls[i]` (not just `contentBlocks`) for the outbound replay converter to pick it up.
