import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

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
});

try {
  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
  const result = await executor.invoke({ input, timeout: 2000 }); // 2 seconds
} catch (e) {
  console.log(e);
  /*
  Error: Cancel: canceled
      at file:///Users/nuno/dev/langchainjs/langchain/dist/util/async_caller.js:60:23
      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
      at RetryOperation._fn (/Users/nuno/dev/langchainjs/node_modules/p-retry/index.js:50:12) {
    attemptNumber: 1,
    retriesLeft: 6
  }
  */
}
