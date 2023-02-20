# Load from Hub

[LangChainHub](https://github.com/hwchase17/langchain-hub) contains a collection of chains which can be loaded directly via LangChain.

For this example, you will also need to install the SerpAPI package for JavaScript/TypeScript.

```bash
npm i serpapi
```

And set the appropriate environment variables in the `.env` file.

```
SERPAPI_API_KEY="..."
```

Now we can get started!

```typescript
import { OpenAI } from "langchain";
import { loadAgent, AgentExecutor } from "langchain/agents";
import { SerpAPI, Calculator } from "langchain/tools";

const model = new OpenAI();
const tools = [new SerpAPI(), new Calculator()];

const agent = await loadAgent(
  "lc://agents/zero-shot-react-description/agent.json",
  { llm: model, tools }
);
console.log("Loaded agent from Langchain hub");

const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
  returnIntermediateSteps: true,
});

const input =
  "Who is Olivia Wilde's boyfriend?" +
  " What is his current age raised to the 0.23 power?";
console.log(`Executing with input "${input}"...`);

const result = await executor.call({ input });

console.log(`Got output ${result.output}`);
```

```shell
langchain-examples:start: Executing with input "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?"...
langchain-examples:start: Got output Olivia Wilde's boyfriend is Jason Sudeikis, and his current age raised to the 0.23 power is 2.4242784855673896.
```
