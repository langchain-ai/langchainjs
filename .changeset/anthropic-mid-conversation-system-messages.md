---
"@langchain/anthropic": patch
---

feat(anthropic): accept a `SystemMessage` anywhere in the message list. Previously only the first message could be a system message. Anything else threw.

A system message that isn't first is now sent at its own position. It applies from that point in the conversation onwards, and adding one leaves the prompt cache for the earlier turns intact.

Two smaller changes come with it. A leading run of two or more `SystemMessage`s now merges into the top-level `system` field instead of being rejected. System content built from standard content blocks no longer sends the internal block `id` to the provider.
