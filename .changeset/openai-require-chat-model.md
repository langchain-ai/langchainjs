---
"@langchain/openai": minor
---

`ChatOpenAI`, `ChatOpenAICompletions` and `ChatOpenAIResponses` now throw at construction when neither `model` nor `modelName` is passed, instead of silently using `gpt-3.5-turbo`, which OpenAI shuts down on October 23, 2026. Subclasses that relied on that default without setting their own, such as `ChatDeepSeek`, also need a model now. Deployment-only `AzureChatOpenAI` configurations are unchanged.
