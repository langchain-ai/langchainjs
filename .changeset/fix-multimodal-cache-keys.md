---
"@langchain/core": patch
---

fix(langchain): implement cache serialization for multimodal messages

Cache keys now include all content blocks (image_url, document, etc.) instead of
only text, preventing false cache hits when multimodal messages share the same
text. Inline base64 data is replaced with a SHA-256 digest to keep keys compact.
Plain-text messages retain the legacy key format for backward compatibility.
