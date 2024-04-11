import { Calculator } from "@langchain/community/tools/calculator";
import { ChatOpenAI } from "@langchain/openai";
import { PlanAndExecuteAgentExecutor } from "langchain/experimental/plan_and_execute";
import { SerpAPI } from "@langchain/community/tools/serpapi";

const tools = [new Calculator(), new SerpAPI()];
const model = new ChatOpenAI({
  temperature: 0,
  model: "gpt-3.5-turbo",
  verbose: true,
});
const executor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
  llm: model,
  tools,
});

const result = await executor.invoke({
  input: `Who is the current president of the United States? What is their current age raised to the second power?`,
});

console.log({ result });
