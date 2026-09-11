---
"@langchain/google": patch
---

fix(google): surface `groundingMetadata`/`groundingSupport`/`citationMetadata` on `.stream()` and `.streamEvents()`, matching what `.invoke()` already returns
