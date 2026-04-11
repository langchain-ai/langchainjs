---
"@langchain/openrouter": minor
"@langchain/core": patch
---

feat(openrouter): surface reasoning content as v1 standard content blocks

`convertOpenRouterResponseToBaseMessage` and
`convertOpenRouterDeltaToBaseMessageChunk` now copy OpenRouter's
`reasoning` (flat string) and `reasoning_details` (structured array) fields
onto `additional_kwargs.reasoning_content` / `additional_kwargs.reasoning_details`.
A new `ChatOpenRouterTranslator` is registered in `@langchain/core` under
the `"openrouter"` provider key so `AIMessage.contentBlocks` emits standard
`{type: "reasoning"}` blocks alongside text and tool calls.

Previously, reasoning text returned by reasoning-capable models routed
through OpenRouter (DeepSeek R1, Minimax M2, Claude extended thinking,
o-series, etc.) was silently dropped: only the `reasoning_tokens` count
was preserved via `usage_metadata`. Consumers using standard content blocks
(including the frontend agent UI patterns shown in the docs) could not
display the model's chain of thought.
