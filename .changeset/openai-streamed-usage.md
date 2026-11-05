---
"@langchain/openai": patch
---

fix(openai): use the token usage reported by the stream instead of estimating it, so streamed calls no longer download the tokenizer encoding
