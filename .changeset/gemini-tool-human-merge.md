---
"@langchain/google": patch
---

Fix `convertMessagesToGeminiContents` merging a `ToolMessage` (functionResponse)
with a following `HumanMessage` (text) into one `user` content. Both map to the
`user` role, and Vertex/Gemini rejects a single `user` content that mixes a
`functionResponse` with text, so a tool result followed by a user message would
fail with a 400. Adjacent tool results (parallel tool calls) still merge.
