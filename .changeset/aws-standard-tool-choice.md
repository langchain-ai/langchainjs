---
"@langchain/aws": patch
---

fix(aws): map the standard `tool_choice` values `"required"` and `{ type: "function", function: { name } }` to Bedrock Converse, so `createAgent` middleware can force a tool call on `ChatBedrockConverse`
