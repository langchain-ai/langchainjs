---
"@langchain/openai": patch
---

fix(openai): surface model refusals as `ModelRefusalError`

Chat Completions keeps `refusal` from responses, refusals are sent back natively on assistant messages (including `v1` messages), and `withStructuredOutput` with `jsonSchema` throws `ModelRefusalError` on a refusal.
