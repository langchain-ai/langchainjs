import { GoogleTrendsAPI } from "@langchain/community/tools/google_trends";
import { OpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
  });

  const tools = [new GoogleTrendsAPI()]; 

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const res = await executor.invoke({
    input: "What are the recent trends in AI research? ",
  });

  console.log(res.output);
}