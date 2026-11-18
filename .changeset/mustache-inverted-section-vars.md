---
"@langchain/core": patch
---

Extract input variables from inside Mustache inverted sections (`{{^key}}...{{/key}}`), so prompts like `PipelinePromptTemplate` pass those values through instead of rendering them empty.
