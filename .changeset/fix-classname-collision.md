---
"langchain": patch
"@langchain/classic": patch
---

fix(langchain): resolve className collision in MODEL_PROVIDER_CONFIG

Fixed a bug where `initChatModel` with `modelProvider: "google-vertexai-web"` incorrectly resolved to `@langchain/google-vertexai` instead of `@langchain/google-vertexai-web`. Both providers share `className: "ChatVertexAI"`, causing `.find()` to return the first match. The fix imports directly from `config.package` since the correct provider mapping is already available.
