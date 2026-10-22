---
"@langchain/cohere": patch
---

fix(cohere): copy tool schema properties instead of mutating them when converting tools, so a reused schema no longer gains a property-level `required` flag
