---
"@langchain/aws": patch
---

Honor `maxRetries` and `onFailedAttempt` for ChatBedrockConverse invoke and stream initialization requests while preserving explicit Bedrock client retry settings.
