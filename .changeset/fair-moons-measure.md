---
"@langchain/textsplitters": patch
---

Use the custom length function to measure separators when merging text chunks.

This may change chunk boundaries when using a custom `lengthFunction`, such as a token counter.
