---
"langchain": patch
---

agents: `modelRetryMiddleware` and `modelFallbackMiddleware` now rethrow graph control-flow exceptions (`interrupt`, `Command`) instead of treating them as model failures. Previously, an interrupt raised inside a wrapped model call was retried (repeating the call with backoff), replaced by a fallback model's response, or converted into a "Model call failed" AIMessage once retries were exhausted - silently swallowing the interrupt so the agent continued instead of pausing. This matches the Python implementation and the existing `toolRetryMiddleware`/`toolErrorMiddleware` behavior.
