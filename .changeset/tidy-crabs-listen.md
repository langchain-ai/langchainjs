---
"@langchain/aws": patch
---

Validate `ChatBedrockConverse.withStructuredOutput` results against the schema. The parser returned the model's tool-call arguments with a bare cast, so an answer that violated a Zod schema reached the caller typed as if it had been checked. Parsing now goes through the same core parser the other tool-calling integrations use, while the existing errors for a missing or mismatched tool call are preserved.
