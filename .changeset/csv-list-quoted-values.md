---
"@langchain/core": patch
---

CommaSeparatedListOutputParser keeps commas inside double-quoted values, like Python's parser, so `"New York, NY", "Paris, France"` parses to two items
