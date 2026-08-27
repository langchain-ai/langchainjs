---
"@langchain/google": patch
---

Fix `convertMessagesToGeminiContents` merging a `ToolMessage` (functionResponse)
with a following `HumanMessage` (text) into one `user` content. Both map to the
`user` role, and Vertex/Gemini rejects a single `user` content that mixes a
`functionResponse` with text, so a tool result followed by a user message would
fail with a 400. Merging is now limited to runs of adjacent tool results
(parallel tool calls), which the API requires to be grouped into one content;
all other same-role contents stay separate.

Also fixes the v1 standard-content path, where a single `ToolMessage` could emit
a `user` content mixing its `functionResponse` part with text parts; tool turns
now carry only their functionResponse part(s), mirroring the legacy path.
