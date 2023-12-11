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
  verbose: true,
});

const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

const result = await executor.invoke({ input });

console.log(result);

/*
  { output: '2.2800773226742175' }
*/
