---
"@langchain/aws": patch
---

fix(aws): skip `tool_call`/`tool_use` content blocks in `convertAIMessageToConverseMessage`

`ChatBedrockConverse` threw `Unsupported content block type: tool_call` when an
assistant message carried a `tool_call` (or `tool_use`) content block in its
`content` array — e.g. when replaying history from another provider or an agent
loop. Tool calls are already serialized from `msg.tool_calls`, so such blocks
are duplicates and are now skipped instead of rejected.