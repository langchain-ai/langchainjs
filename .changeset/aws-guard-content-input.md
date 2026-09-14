---
"@langchain/aws": patch
---

Accept Bedrock `guardContent` blocks on input. `ChatBedrockConverse` threw `Unsupported content block type` while converting messages, so guardrail selective input tagging — scoping a guardrail to only part of a message — was unreachable from the JS binding, though the Converse API accepts it and the Python binding sends it. Both the raw `{ guardContent }` shape and the `{ type: "guard_content", guardContent }` shape this package's own output converter emits now pass through. Unknown blocks still throw.
