---
"@langchain/core": patch
---

fix(core): escape `drawMermaid` node metadata labels and leave out object values, so metadata with brackets or objects no longer breaks Mermaid parsing
