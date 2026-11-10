---
"langchain": patch
---

feat(langchain): add model router and auto mode middleware

- Add `modelRouterMiddleware`, which picks the agent's model for each run from a decision model's `Choice` answer
- Add `autoModeMiddleware`, which blocks listed tool calls that a decision model judges risky
