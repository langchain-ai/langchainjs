---
"@langchain/openai": patch
---

Add model profiles for 13 OpenAI models that had no entry, including `gpt-5.4-mini`, `gpt-5.4-nano` and the `gpt-5.6` family. An absent profile resolves to `{}`, which is indistinguishable from "supports nothing": `createAgent({ responseFormat })` silently fell back from native json_schema to tool-call emulation, and token-aware middleware mis-sized the context window. No existing entries are modified or removed.
