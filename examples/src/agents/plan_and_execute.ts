import { Calculator } from "langchain/tools/calculator";
import { SerpAPI } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { PlanAndExecuteAgentExecutor } from "langchain/experimental/plan_and_execute";

const tools = [new Calculator(), new SerpAPI()];
const model = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-3.5-turbo",
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
