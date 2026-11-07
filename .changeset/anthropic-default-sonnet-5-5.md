---
"@langchain/anthropic": minor
---

Change the default `ChatAnthropic` model from `claude-sonnet-4-5-20250929`, which Anthropic retires on November 30, 2026, to `claude-sonnet-5-5`. Models passed explicitly are sent unchanged. Code that relies on the default now runs adaptive thinking by default and should read response content by block type. Non-default `temperature`, `topP`, and `topK`, thinking budgets, `thinking: { type: "disabled" }`, and forced tool choice are not supported on the new default. Pass `model` explicitly to keep a previous model.
