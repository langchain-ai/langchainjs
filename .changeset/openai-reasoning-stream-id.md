---
"@langchain/openai": patch
---

fix(openai): omit empty reasoning item id in Responses API input

Reasoning blocks reassembled from streaming chunks (e.g. via `streamEvents`) never carry an id, since OpenAI's streaming protocol only includes it in non-streaming responses. When such a message was replayed as Responses API input on the next turn, the reasoning item was emitted with `id: ""`, which OpenAI rejects with `400 Invalid 'input[n].id': ''`. The `id` field is now omitted when absent, matching how the legacy reconstruction path already handles a missing id.
