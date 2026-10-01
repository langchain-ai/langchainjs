---
"@langchain/cohere": patch
---

Report Cohere tool calls' name, id and arguments in `streamEvents`

`streamEvents()` (and `invoke()` when a stream-event handler is attached) read
the tool calls in Cohere's `stream-end` event as OpenAI-shaped
`{ id, function: { name, arguments } }`. Cohere sends `{ name, parameters }`
with no id, so every tool call came out with no name, no id and empty
arguments. They now carry the tool's name and parameters, and an id generated
the same way as non-streaming `invoke()`.
