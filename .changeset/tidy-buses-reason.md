---
"@langchain/core": patch
"@langchain/openai": patch
---

Preserve provider payloads in the content-block streaming protocol (`model.streamEvents(...)` without a version): add `additionalKwargs` to the `message-finish` stream event, bridge legacy chunk `additional_kwargs` through it, and store the raw Responses API reasoning item, function call item IDs and preserved response output in ChatOpenAI's native event stream so multi-turn replays keep reasoning items.
