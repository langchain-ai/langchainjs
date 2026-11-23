---
"@langchain/anthropic": patch
"langchain": patch
"@langchain/classic": patch
---

Replace retiring Claude Sonnet 4.5 and Opus 4.5 model IDs with Claude Sonnet 5.5 and Opus 5.5. `ChatAnthropic` now defaults to `claude-sonnet-5-5` instead of `claude-sonnet-4-5-20250929`. Claude Opus 5.5 and Sonnet 5.5 are treated as always-on thinking models: `withStructuredOutput` no longer forces a tool call for them, and an explicit `thinking: { type: "disabled" }` is rejected.
