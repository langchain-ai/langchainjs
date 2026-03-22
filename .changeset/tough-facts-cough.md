---
"@langchain/google": patch
---

Undo regression introduced in #10397 in legacy content processing path.
Fixes issues with a false duplicate functionCall sent in response (#10474).