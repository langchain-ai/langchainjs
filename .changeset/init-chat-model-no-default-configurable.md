---
"langchain": patch
---

fix(langchain): make `ConfigurableModel` non-configurable when `configurableFields` is omitted

`initChatModel` with a model and no `configurableFields` (and direct `new ConfigurableModel(...)` without it) no longer lets `configurable.model` / `configurable.modelProvider` swap the model at invoke time, matching the docs. Pass `configurableFields: ["model", "modelProvider"]` to keep runtime model swapping.
