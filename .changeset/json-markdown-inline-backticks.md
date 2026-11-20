---
"@langchain/core": patch
---

parseJsonMarkdown strips backticks around unfenced JSON, so output like `{"a": 1}` written as inline code parses like it does in Python
