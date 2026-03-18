---
"@langchain/anthropic": patch
---

fix(anthropic): route HumanMessage contentBlocks through standard content formatter

When HumanMessage is created with contentBlocks, content blocks were processed through _formatContentBlocks which lacks support for text-plain blocks and rich metadata (citations, context, title) on file blocks. This change routes any message created with contentBlocks through _formatStandardContent, which has complete support for all standard content block types.
