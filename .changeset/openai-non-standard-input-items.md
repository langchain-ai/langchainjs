---
"@langchain/openai": patch
---

fix(openai): accept `non_standard`-wrapped `configuration_update` and `mcp_approval_response` blocks. Previously only a bare block in `content` was hoisted to a top-level Responses API input item; a wrapped block, or one on a message built with `contentBlocks`, was silently dropped. Chat Completions now also sends the payload of a `non_standard` block rather than the wrapper.
