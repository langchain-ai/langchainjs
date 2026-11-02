---
"@langchain/aws": patch
---

Fix ChatBedrockConverse retry classification for AWS HTTP errors and content-filter failures while keeping ThrottlingException and ModelNotReadyException retryable. Internally created Bedrock clients now default to `maxAttempts: 1` so SDK retries do not stack with LangChain retries; explicit `clientOptions.maxAttempts` values and injected clients remain unchanged.
