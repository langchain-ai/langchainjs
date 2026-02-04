---
"langchain": patch
---

feat(langchain): add withConfig() method to ReactAgent

Adds a `withConfig()` method to ReactAgent following the same pattern as LangGraph's `Pregel.withConfig()`. This allows setting default configuration values (like `recursionLimit`, `tags`, or `configurable`) that get merged with invocation-time config.
