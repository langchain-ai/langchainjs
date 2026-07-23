---
"@langchain/openai": patch
---

Regenerate model profiles so newer OpenAI models advertise their capabilities. Adds `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.6` and others, which previously resolved to an empty profile and silently lost native structured output.
