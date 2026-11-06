---
"langchain": patch
---

`initChatModel` no longer caches a new model instance for every LangGraph run or every call with different metadata. The instance cache is now keyed on the configurable model params only, and with `configurableFields: "any"` LangGraph's `thread_id`, `checkpoint_*` and `__pregel_*` keys are no longer passed to the model.
