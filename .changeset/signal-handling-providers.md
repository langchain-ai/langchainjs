---
"@langchain/openai": patch
"@langchain/anthropic": patch
"@langchain/google-genai": patch
"@langchain/google-common": patch
"@langchain/aws": patch
"@langchain/groq": patch
"@langchain/mistralai": patch
"@langchain/cohere": patch
"@langchain/ollama": patch
"@langchain/cloudflare": patch
"@langchain/deepseek": patch
"@langchain/xai": patch
"@langchain/standard-tests": patch
---

fix(providers): add proper abort signal handling for invoke and stream operations

- Added early abort check (`signal.throwIfAborted()`) at the start of `_generate` methods to immediately throw when signal is already aborted
- Added abort signal checks inside streaming loops in `_streamResponseChunks` to return early when signal is aborted
- Propagated abort signals to underlying SDK calls where applicable (Google GenAI, Google Common/VertexAI, Cohere)
- Added standard tests for abort signal behavior in `@langchain/standard-tests`

This enables proper cancellation behavior for both invoke and streaming operations, and allows fallback chains to correctly proceed to the next runnable when the previous one is aborted.
