---
"@langchain/openai": patch
---

Report the Azure OpenAI deployment name as the model in tracing and callback data. When `AzureChatOpenAI` is constructed with only `azureOpenAIApiDeploymentName`, `ls_model_name` and `invocation_params.model` no longer fall back to the `gpt-3.5-turbo` default. The correction is applied in the `AzureChatOpenAICompletions` and `AzureChatOpenAIResponses` delegates, so it holds for bare, `.withConfig()`, and `.bindTools()` calls across both the Chat Completions and Responses APIs. Explicitly configured models are preserved.
