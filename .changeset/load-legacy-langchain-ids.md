---
"@langchain/core": patch
---

`load` resolves ids under the legacy `langchain` namespace, such as `["langchain", "schema", "messages", "HumanMessage"]` as written by older packages and by Python's `langchain_core`, to the same classes under `langchain_core`, as Python's `load` does. A caller's `importMap` still takes precedence.
