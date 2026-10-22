---
"@langchain/anthropic": patch
---

fix(anthropic): add task budget beta header for all models that support task budgets

`getTaskBudgetBetas` only attached the `task-budgets-2026-03-13` beta header for `claude-opus-4-7`, so setting `outputConfig.task_budget` on `claude-opus-4-8`, `claude-fable-5`, or `claude-mythos-5` sent the beta-gated field without the required header. Task budgets are in beta on all of these models, so the header is now attached for the full adaptive-only model set.
