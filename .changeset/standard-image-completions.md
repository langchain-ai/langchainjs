---
"@langchain/openai": patch
"@langchain/openrouter": patch
---

Convert standard image blocks in unversioned user message content to image_url for Chat Completions requests, including OpenRouter.

Encode binary image data as base64 rather than interpolating its byte values into the data URL.
