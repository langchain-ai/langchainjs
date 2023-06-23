import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { Calculator } from "langchain/tools/calculator";
import { SerpAPI } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { runOnDataset } from "langchain/client";

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-0613",
  temperature: 0,
  maxConcurrency: 5,
});

const tools = [
  new Calculator(),
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
];

await runOnDataset("ds-brief-green-74", () =>
  initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "chat-conversational-react-description",
  })
);
