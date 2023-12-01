import { GooglePlacesAPI } from "langchain/tools/google_places";
import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
  });

  const tools = [new GooglePlacesAPI()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const res = await executor.call({
    input: "Where is the University of Toronto - Scarborough? ",
  });

  console.log(res.output);
}
