---
"@langchain/google": patch
---

When `googleAuthOptions` is provided, `NodeApiClient` no longer falls back to the
ambient `GOOGLE_API_KEY` environment variable. Explicitly configured OAuth (e.g.
Vertex AI with Application Default Credentials) previously lost header priority
to whatever key happened to be set in the environment, causing Vertex requests
to fail with "API keys are not supported by this API".
