---
"@langchain/core": patch
---

fix(core): fix streaming chunk merge for providers without `index` on tool call deltas

`_mergeLists` now falls back to `id`-based matching when items don't have an `index` field. Previously, providers routing through the OpenAI-compatible API without `index` on streaming tool call deltas (e.g. Anthropic models via `ChatOpenAI`) would accumulate hundreds of individual raw deltas in `tool_call_chunks` and `additional_kwargs.tool_calls` instead of merging them into a single entry per tool call. In a real trace with 3 concurrent subagents, this caused a single AI message to balloon from ~4KB to 146KB -- with 826 uncollapsed streaming fragments carrying a few bytes each.

Also fixes `SystemMessage.concat()` which used `...this` to spread all instance properties (including `lc_kwargs`) into the new constructor, causing each chained `concat()` call to nest one level deeper. After 7 middleware `concat()` calls (typical in deepagents), a 7KB system prompt would serialize to 81KB due to content being duplicated at every nesting level.
