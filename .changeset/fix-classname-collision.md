---
"langchain": patch
"@langchain/classic": patch
---

fix(langchain): resolve className collision in MODEL_PROVIDER_CONFIG

Refactored `getChatModelByClassName` to accept an optional `modelProvider` parameter for direct lookup, avoiding the className collision issue where multiple providers share the same className (e.g., `google-vertexai` and `google-vertexai-web` both use `"ChatVertexAI"`). When `modelProvider` is provided, the function uses direct config lookup instead of searching by className. Backward compatibility is maintained for existing callers that only pass `className`. This eliminates the duplicated import logic that was previously in `_initChatModelHelper`.
