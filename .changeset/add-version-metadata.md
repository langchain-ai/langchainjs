---
"@langchain/core": patch
"@langchain/anthropic": patch
"@langchain/aws": patch
"@langchain/baidu-qianfan": patch
"@langchain/cerebras": patch
"@langchain/cloudflare": patch
"@langchain/cohere": patch
"@langchain/deepseek": patch
"@langchain/google": patch
"@langchain/google-common": patch
"@langchain/google-gauth": patch
"@langchain/google-genai": patch
"@langchain/google-vertexai": patch
"@langchain/google-vertexai-web": patch
"@langchain/google-webauth": patch
"@langchain/groq": patch
"@langchain/mistralai": patch
"@langchain/ollama": patch
"@langchain/openai": patch
"@langchain/openrouter": patch
"@langchain/xai": patch
"@langchain/yandex": patch
---

Add package version metadata to runnable traces. Each package now stamps its version in `this.metadata.versions` at construction time, making version info available in LangSmith trace metadata.
