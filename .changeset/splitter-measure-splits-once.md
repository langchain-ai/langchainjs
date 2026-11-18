---
"@langchain/textsplitters": patch
---

perf(textsplitters): call `lengthFunction` once per split in `RecursiveCharacterTextSplitter` instead of measuring the same pieces again while merging, which makes token-based splitting up to ~3x faster
