---
"@langchain/anthropic": patch
---

Fix temperature/topK/topP handling: guard all three so undefined values are not
set on the request object, and fix broken topK/topP validation when thinking is
enabled.
