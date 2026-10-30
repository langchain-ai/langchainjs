---
"@langchain/core": patch
---

`load` resolves ids under the legacy `langchain` namespace, such as `["langchain", "schema", "messages", "HumanMessage"]` as written by older packages and by Python's `langchain_core`, through the package's own aliases for them. A caller's `importMap` still takes precedence, per class.
