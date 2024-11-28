import { GoogleFinanceAPI } from "@langchain/community/tools/google_finance";
import { OpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const tools = [new GoogleFinanceAPI()];

  const financeAgent = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const result = await financeAgent.invoke({
    input: "What is the price of GOOG:NASDAQ?",
  });

  console.log(result.output);
}
