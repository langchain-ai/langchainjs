---
"@langchain/core": patch
---

Fix `XMLOutputParser` losing parent and sibling elements after a self-closing tag. Self-closing elements now preserve the same tree structure as explicitly closed empty elements, including in streamed output.
