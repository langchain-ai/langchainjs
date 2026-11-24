---
"@langchain/aws": minor
---

feat(aws): add `method: "jsonSchema"` to `ChatBedrockConverse.withStructuredOutput` and use it by default on Claude Opus 5.5 and Sonnet 5.5, which reject a forced `tool_choice`
