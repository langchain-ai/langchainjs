---
"@langchain/anthropic": patch
---

Preserve the generic `tool_search_tool_result` block type in streaming output and message payload conversion. The Anthropic API emits this un-suffixed type for both tool search variants; previously only the variant-suffixed names were allowlisted, so multi-turn conversations using tool search still failed with INVALID_TOOL_RESULTS after a client-tool round-trip.
