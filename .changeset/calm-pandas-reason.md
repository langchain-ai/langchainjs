---
"@langchain/aws": patch
"@langchain/core": patch
---

fix(aws): normalize and safely replay Bedrock reasoning blocks

Emit standard reasoning blocks with preserved signatures, omit incomplete signature-only reasoning during replay, and retain compatibility with legacy and redacted Bedrock reasoning.
