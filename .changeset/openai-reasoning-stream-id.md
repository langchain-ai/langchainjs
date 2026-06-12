---
"@langchain/openai": patch
---

fix(openai): omit empty id and content on reasoning items in Responses API input

Reasoning blocks reassembled from streaming chunks (e.g. via `streamEvents`) never carry an id, since OpenAI's streaming protocol only includes it in non-streaming responses. When such a message was replayed as Responses API input on the next turn, the reasoning item was emitted with `id: ""`, which OpenAI rejects with `400 Invalid 'input[n].id': ''`. The `id` field is now omitted when absent.

A second error surfaced immediately after that fix: the same converter set a populated `content` array on the reasoning input item, which the Responses API also rejects (`400 Invalid 'input[n].content': array too long. Expected an array with maximum length 0`). Reasoning input items only carry `summary`, so `content` is no longer forwarded. Thanks to @csrujanreddy for catching the second issue and verifying both fixes against the live API.
