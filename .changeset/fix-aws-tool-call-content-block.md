---
"@langchain/aws": patch
---

fix(aws): stop `ChatBedrockConverse` throwing `Unsupported content block type: tool_call` on a content block it produces itself, and convert one that `tool_calls` does not carry instead of dropping it
