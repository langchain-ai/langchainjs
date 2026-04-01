---
"@langchain/google": patch
---

fix(@langchain/google): fail fast for Claude models on Vertex with actionable guidance

`ChatGoogle` now throws a clear `ConfigurationError` when a Claude model is used on Vertex AI, and points users to `@langchain/anthropic` with the Vertex SDK path. Added unit and integration tests to keep this behavior deterministic.
