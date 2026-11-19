---
"@langchain/aws": patch
---

Emit raw `finishReason`, `normalizedFinishReason` and `finishState` on Bedrock Converse `message-finish` events; unmapped stop reasons normalize to `other`.
