---
"@langchain/textsplitters": patch
---

count the separators between retained splits toward `chunkOverlap`, as the Python splitter does, so `CharacterTextSplitter` no longer keeps overlaps larger than `chunkOverlap`
