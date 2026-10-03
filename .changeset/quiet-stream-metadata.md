---
"@langchain/core": patch
"@langchain/openai": patch
---

Preserve provider message fields when assembling native chat-model streams. OpenAI Responses streams retain response metadata, reasoning summaries, and provider content identities and indices. Emit the completed response model once when concatenating legacy response chunks. Build Core and OpenAI packages before packing source checkouts.
