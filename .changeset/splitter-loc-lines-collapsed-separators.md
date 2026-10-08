---
"@langchain/textsplitters": patch
---

fix(textsplitters): compute `loc.lines` correctly when a merged chunk is not a verbatim substring of the source text (e.g. runs of separators that were collapsed)
