---
"@langchain/google-genai": patch
"@langchain/google": patch
---

Add LangSmith gateway support for Google Gemini (Developer API) models. When `LANGSMITH_GATEWAY` is set, `ChatGoogleGenerativeAI` and `ChatGoogle` (and `initChatModel("google-genai:...")`) route requests through the gateway's Gemini path, using the gateway key (falling back to `LANGSMITH_API_KEY`). An explicit `baseUrl`/`endpoint`, an explicit `apiKey`, or a Vertex AI configuration suppress gateway routing. Also adds `GEMINI_API_KEY` as a fallback env var for `ChatGoogleGenerativeAI`.
