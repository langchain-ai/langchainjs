---
"@langchain/openrouter": patch
---

Guard against a 200 response with no `choices` key in `ChatOpenRouter._generate`. It previously read `data.choices[0]` without optional chaining, throwing a bare `TypeError` before the `if (!choice)` guard could raise the intended `OpenRouterError("No choices returned in response.")`. Now uses `data.choices?.[0]`, matching the streaming path. Fixes #11417.
