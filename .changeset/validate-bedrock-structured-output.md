---
"@langchain/aws": patch
---

fix(aws): validate Bedrock structured output tool args against the schema

`withStructuredOutput` on `ChatBedrockConverse` returned the raw tool-call
arguments without validating them against the provided schema. Route the tool
call through the shared `createFunctionCallingParser`, so structured output is
parsed and validated consistently with the other providers.
