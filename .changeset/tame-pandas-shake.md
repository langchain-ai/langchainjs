---
"@langchain/aws": patch
---

Convert tool blocks to plain text when no tools are bound, so Converse requests don't fail with a ValidationException on `toolConfig`.
