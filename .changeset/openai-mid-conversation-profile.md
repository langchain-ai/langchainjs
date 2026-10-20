---
"@langchain/openai": patch
---

feat(openai): declare mid-conversation support in model profiles. GPT-4.1, GPT-5.x, GPT-6.x and o3 set `midConversationSystemMessages` and `midConversationTools`. `midConversationTools` is `false` on Chat Completions, since only the Responses API carries an `additional_tools` input item, so `ChatOpenAI` reports it only when it routes to the Responses API. `AzureChatOpenAI` and `AzureChatOpenAIResponses` leave it unset, since it is unverified on Azure's API.

Regenerating the profiles from models.dev also adds GPT-6 Sol, GPT-6 Luna and GPT-6.1 Sol.
