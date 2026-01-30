---
"@langchain/core": minor
"@langchain/standard-tests": patch
"@langchain/openai": patch
"@langchain/anthropic": patch
"@langchain/google-genai": patch
"@langchain/google-common": patch
"@langchain/google-vertexai": patch
"@langchain/aws": patch
"@langchain/groq": patch
"@langchain/mistralai": patch
"@langchain/cohere": patch
"@langchain/ollama": patch
"@langchain/cloudflare": patch
"@langchain/deepseek": patch
"@langchain/xai": patch
---

Improved abort signal handling for chat models:

- Added `ModelAbortError` class in `@langchain/core/errors` that contains partial output when a model invocation is aborted mid-stream
- `invoke()` now throws `ModelAbortError` with accumulated `partialOutput` when aborted during streaming (when using streaming callback handlers)
- `stream()` throws a regular `AbortError` when aborted (since chunks are already yielded to the caller)
- All provider implementations now properly check and propagate abort signals in both `_generate()` and `_streamResponseChunks()` methods
- Added standard tests for abort signal behavior
