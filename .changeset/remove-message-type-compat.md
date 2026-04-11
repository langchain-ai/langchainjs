---
"@langchain/core": patch
---

fix(core): make `RemoveMessage` type-compatible across `MessageStructure` variants

Remove unnecessary `TStructure` generic from `RemoveMessage` — its content is always `[]`, so the type parameter only caused incompatibilities when passing `RemoveMessage` into APIs expecting a different `MessageStructure` (e.g. `@langchain/langgraph-sdk`'s `Message<DefaultToolCall>`). Also add `{ type: "remove"; id: string }` to `BaseMessageLike` so the serialized format is accepted by TypeScript, matching the existing runtime behavior in `coerceMessageLikeToMessage`.
