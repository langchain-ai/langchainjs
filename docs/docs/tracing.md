# Tracing

Similar to the python `langchain` package, `langchain.js` support tracing.

You can view an overview of tracing [here.](https://langchain.readthedocs.io/en/latest/tracing.html)

Here's an example of how to use tracing in `langchain.js`. All that needs to be done is setting the `LANGCHAIN_HANDLER` environment variable to `langchain`.

```typescript
import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { SerpAPI, Calculator } from "langchain/tools";
import process from "process";

export const run = async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
  const model = new OpenAI({ temperature: 0 });
  const tools = [new SerpAPI(), new Calculator()];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
```
