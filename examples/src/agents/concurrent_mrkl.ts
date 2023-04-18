import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import process from "process";
import { getTracingCallbackManager } from "langchain/callbacks";

export const run = async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
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

  const tracingCallbackManager = await getTracingCallbackManager();
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  // This will result in a lot of errors, because the shared Tracer is not concurrency-safe.
  const [resultA, resultB, resultC] = await Promise.all([
    executor.call({ input }, tracingCallbackManager),
    executor.call({ input }, tracingCallbackManager),
    executor.call({ input }, tracingCallbackManager),
  ]);

  console.log(`Got output ${resultA.output} ${resultA.__runMetadata.__runId}`);
  console.log(`Got output ${resultB.output} ${resultB.__runMetadata.__runId}`);
  console.log(`Got output ${resultC.output} ${resultC.__runMetadata.__runId}`);
};
