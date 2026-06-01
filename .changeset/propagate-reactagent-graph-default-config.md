---
"langchain": patch
---

fix(langchain): propagate ReactAgent withConfig defaults to inner graph

Apply static defaults from `#defaultConfig` onto the compiled pregel so
`recursionLimit`, metadata, and other LangGraph config survives LangGraph API
loading, which unwraps ReactAgent to `.graph` before execution.
