---
"@langchain/core": patch
---

feat(core): add `midConversationSystemMessages` and `midConversationTools` to `ModelProfile`. They say whether a chat model sends a system message after the first turn in place, and whether it can add a tool through a message rather than the request's tool list. Either way the prompt prefix before it stays unchanged.
