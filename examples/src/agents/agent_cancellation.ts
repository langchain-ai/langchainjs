import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "@langchain/openai";
import { Calculator } from "@langchain/community/tools/calculator";
import { SerpAPI } from "@langchain/community/tools/serpapi";

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
const controller = new AbortController();

// Call `controller.abort()` somewhere to cancel the request.
setTimeout(() => {
  controller.abort();
}, 2000);

try {
  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
  const result = await executor.invoke({ input, signal: controller.signal });
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
