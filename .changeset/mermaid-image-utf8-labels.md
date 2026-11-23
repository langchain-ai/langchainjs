---
"@langchain/core": patch
---

Fix `drawMermaidImage` (and `drawMermaidPng`) for graphs whose node or edge labels contain non-ASCII text. The Mermaid syntax is now base64url-encoded as UTF-8, so CJK or emoji labels no longer throw `InvalidCharacterError` and accented Latin-1 labels are no longer sent to mermaid.ink as mis-encoded bytes.
