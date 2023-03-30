# Agent with Zapier NLA Integration

Full docs here: https://nla.zapier.com/api/v1/dynamic/docs

**Zapier Natural Language Actions** gives you access to the 5k+ apps, 20k+ actions on Zapier's platform through a natural language API interface.

NLA supports apps like Gmail, Salesforce, Trello, Slack, Asana, HubSpot, Google Sheets, Microsoft Teams, and thousands more apps: https://zapier.com/apps

Zapier NLA handles ALL the underlying API auth and translation from natural language --> underlying API call --> return simplified output for LLMs. The key idea is you, or your users, expose a set of actions via an oauth-like setup window, which you can then query and execute via a REST API.

NLA offers both API Key and OAuth for signing NLA API requests.

Server-side (API Key): for quickly getting started, testing, and production scenarios where LangChain will only use actions exposed in the developer's Zapier account (and will use the developer's connected accounts on Zapier.com)

User-facing (Oauth): for production scenarios where you are deploying an end-user facing application and LangChain needs access to end-user's exposed actions and connected accounts on Zapier.com

This quick start will focus on the server-side use case for brevity. Review full docs or reach out to nla@zapier.com for user-facing oauth developer support.

This example goes over how to use the Zapier integration an Agent. In code, below:

```typescript
import { OpenAI } from "langchain";
import { initializeAgentExecutor, ZapierToolKit } from "langchain/agents";
import { ZapierNLAWrapper } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const zapier = new ZapierNLAWrapper();
  const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);

  const executor = await initializeAgentExecutor(
    toolkit.tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `Summarize the last email I received regarding Silicon Valley Bank. Send the summary to the #test-zapier Slack channel.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
```
