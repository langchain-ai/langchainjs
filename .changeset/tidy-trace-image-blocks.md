---
"@langchain/core": patch
---

Fix tracing of multimodal messages so that every base64/URL image content block is converted, not just the first one in a message.
