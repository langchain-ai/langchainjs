---
"@langchain/openai": minor
"@langchain/core": patch
---

feat(openai): add support for phase parameter on Responses API messages

- Extract `phase` from message output items and surface it on text content blocks
- Support phase in streaming via `response.output_item.added` events
- Round-trip phase through both raw provider and standard content paths
- Move phase into `extras` dict in the core standard content translator
