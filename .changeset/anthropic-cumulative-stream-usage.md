---
"@langchain/anthropic": patch
---

Use the cumulative usage on streamed `message_delta` events, so input and cache tokens added by server tools (e.g. web search) are counted and output tokens aren't double counted.
