---
"@langchain/core": patch
---

fix(core): include multimodal content in cache keys to prevent collisions

Cache keys for messages with image, audio, or file content blocks were using
generic placeholders (`[image]`, `[audio]`, `[file]`) that contained no
distinguishing data. This caused two calls with identical text but different
images to return the same cached response.

The fix adds `_serializeCachePrompt()` which:
- Falls back to `getBufferString()` for plain-text messages (backward compat)
- Uses JSON serialization with SHA-256 digests for base64 data in multimodal messages
- Handles both OpenAI-style data URLs and Anthropic/Google-style raw base64 blocks
