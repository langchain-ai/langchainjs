---
"@langchain/aws": patch
---

feat(aws): Add bedrockApiKey, bedrockApiSecret, and bedrockApiSessionToken to ChatBedrockConverse

- New constructor fields allow passing AWS credentials directly instead of relying solely on the default credential provider chain
- Falls back to BEDROCK_AWS_ACCESS_KEY_ID, BEDROCK_AWS_SECRET_ACCESS_KEY, and BEDROCK_AWS_SESSION_TOKEN environment variables
- Explicit `credentials` field still takes highest priority
