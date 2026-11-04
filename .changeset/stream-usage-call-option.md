---
"@langchain/anthropic": patch
"@langchain/cohere": patch
"@langchain/mistralai": patch
---

Fix per-call streamUsage being ignored in ChatAnthropic, ChatCohere, and ChatMistralAI. The per-call value now takes precedence over the instance default, so streamUsage false on a single call actually suppresses usage, and streamUsage true on a single call actually enables it even when the instance default is false.
