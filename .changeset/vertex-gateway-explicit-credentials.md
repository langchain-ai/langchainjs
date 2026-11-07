---
"@langchain/google-common": patch
"@langchain/google": patch
"@langchain/google-vertexai": patch
"@langchain/google-vertexai-web": patch
---

Only route Google chat models through the LangSmith gateway when no credentials are passed. Explicit `apiKey`, `authOptions`, `credentials`, or `googleAuthOptions` now go straight to Google.
