---
"@langchain/openai": patch
---

Expose the Azure deployment name in tracing metadata and invocation params so `ls_model_name` no longer falls back to the `gpt-3.5-turbo` default when `AzureChatOpenAI` is constructed with only `azureOpenAIApiDeploymentName`.
