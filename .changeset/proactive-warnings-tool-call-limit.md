---
"langchain": minor
---

feat(langchain/agents): Add proactive warnings to toolCallLimitMiddleware

When `proactive: true` is set, the middleware injects a system message warning the LLM when the remaining tool call budget approaches the limit, allowing it to plan tool usage more carefully before being cut off.
