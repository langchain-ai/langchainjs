---
"@langchain/textsplitters": patch
---

fix(textsplitters): TokenTextSplitter no longer cuts multi-byte characters in half, which left U+FFFD in the chunks (and dropped the character) for emoji and most CJK text
