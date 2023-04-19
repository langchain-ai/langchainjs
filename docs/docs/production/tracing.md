# Tracing

Similar to the Python `langchain` package, JS `langchain` also supports tracing.

You can view an overview of tracing [here.](https://langchain.readthedocs.io/en/latest/tracing.html)
To spin up the tracing backend, run `docker compose up` (or `docker-compose up` if on using an older version of `docker`) in the `langchain` directory.
You can also use the `langchain-server` command if you have the python `langchain` package installed.

Here's an example of how to use tracing in `langchain.js`. All that needs to be done is setting the `LANGCHAIN_TRACING` environment variable to `true`.

```typescript
import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import process from "process";

export const run = async () => {
  process.env.LANGCHAIN_TRACING = "true";
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
```

## Concurrency

Tracing works with concurrency out of the box.

```typescript
import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import process from "process";

export const run = async () => {
  process.env.LANGCHAIN_TRACING = "true";
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  // This will result in a lot of errors, because the shared Tracer is not concurrency-safe.
  const [resultA, resultB, resultC] = await Promise.all([
    executor.call({ input }),
    executor.call({ input }),
    executor.call({ input }),
  ]);

  console.log(`Got output ${resultA.output} ${resultA.__run.runId}`);
  console.log(`Got output ${resultB.output} ${resultB.__run.runId}`);
  console.log(`Got output ${resultC.output} ${resultC.__run.runId}`);

  /*
    Got output Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557. b8fb98aa-07a5-45bd-b593-e8d7376b05ca
    Got output Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557. c8d916d5-ca1d-4702-8dd7-cab5e438578b
    Got output Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557. bf5fe04f-ef29-4e55-8ce1-e4aa974f9484
    */
};
```
