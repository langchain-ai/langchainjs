---
"langchain": patch
---

fix(langchain): make `initChatModel` non-configurable when a model is given without `configurableFields`

Previously `configurable.model` / `configurable.modelProvider` at invoke time could still swap the model, contrary to the docs. Pass `configurableFields: ["model", "modelProvider"]` to keep runtime model swapping.
