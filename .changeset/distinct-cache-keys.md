---
"@langchain/core": patch
---

Encode cache key parts unambiguously so distinct prompt and LLM keys cannot return each other's cached generations. Existing entries using the default encoder will be repopulated on the next lookup.
