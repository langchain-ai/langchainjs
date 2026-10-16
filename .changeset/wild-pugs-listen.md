---
"langchain": patch
---

Drop provider built-in tools (OpenAI Responses tools, Anthropic server tools, Gemini built-ins) from `modelFallbackMiddleware` retries that target a different provider, and warn when a fallback attempt starts.
