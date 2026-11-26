---
"@langchain/textsplitters": patch
---

fix(textsplitters): keep an oversized split whole instead of splitting it by character (or throwing with `keepSeparator: false`) once `RecursiveCharacterTextSplitter` has used its last separator
