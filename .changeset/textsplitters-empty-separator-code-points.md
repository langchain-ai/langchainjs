---
"@langchain/textsplitters": patch
---

fix(textsplitters): split on an empty separator by code point instead of UTF-16 code unit, so astral characters such as emoji are no longer cut into lone surrogates
