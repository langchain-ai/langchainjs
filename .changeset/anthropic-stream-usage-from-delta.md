---
"@langchain/anthropic": patch
---

Report streamed usage from the cumulative `message_delta` usage, as `langchain-anthropic` does, so input and cache tokens from server tool passes (e.g. web search) are counted and output tokens aren't double counted.
