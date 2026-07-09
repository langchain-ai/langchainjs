---
"@langchain/core": patch
---

fix(core): coerce string v1 AIMessage content to text blocks

Prevent `contentBlocks.push is not a function` when constructing an
`AIMessage` with `response_metadata.output_version === "v1"` and string
`content` (common in serialized LangGraph stream payloads).
