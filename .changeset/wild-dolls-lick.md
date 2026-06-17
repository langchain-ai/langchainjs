---
"langchain": patch
---

feat(aws): bedrock prompt caching middleware

Adds bedrockPromptCachingMiddleware. The interface largely matches what was previous implemented with anthropicPromptCachingMiddleware, making a best-effort attempt at utilizing prompt caching features for supported models.
