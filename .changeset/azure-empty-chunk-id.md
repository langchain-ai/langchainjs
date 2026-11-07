---
"@langchain/core": patch
---

Treat a leading OpenAI-compatible stream chunk with an empty `id` and no `choices` as not-yet-started, so Azure OpenAI streams keep the real provider message id. An empty `id` is also dropped from `message-start`, allowing the `run-<runId>` fallback instead of emitting `id: ""` for every message.