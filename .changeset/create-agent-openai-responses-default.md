---
"langchain": minor
---

`createAgent` now uses the OpenAI Responses API by default when `model` is an `openai:` string. To keep using Chat Completions, pass a model instance, e.g. `new ChatOpenAI({ model: "gpt-5.5", useResponsesApi: false })`.
