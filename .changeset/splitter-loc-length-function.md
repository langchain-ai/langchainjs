---
"@langchain/textsplitters": patch
---

fix(textsplitters): use character length when computing `loc.lines` so a custom `lengthFunction` no longer shifts line numbers
