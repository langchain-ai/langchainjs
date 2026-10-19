---
"@langchain/xai": minor
---

feat(xai): stream Responses tool-call args as `tool-call-delta` slices

- In Responses mode, tool-call args now stream as `tool-call-delta` slices, through `@langchain/openai`'s converter.
- The `@langchain/core` peer is now `^1.3.0`, so pinning `@langchain/core` below 1.3.0 also keeps xAI on snapshots.
