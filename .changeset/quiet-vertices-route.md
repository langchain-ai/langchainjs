---
"@langchain/google-vertexai": patch
"@langchain/google-vertexai-web": patch
"@langchain/google-common": patch
---

Backport LangSmith gateway routing to `ChatVertexAI` in the Node and web packages through `@langchain/google-common`, including streaming, custom gateway URLs, and explicit regional project configuration. Honor custom endpoints in Vertex Express requests.
