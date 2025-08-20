import { GooglePlacesAPI } from "@langchain/community/tools/google_places";
import { OpenAI } from "@langchain/openai";
// @ts-expect-error - createReactAgent is not yet available
import { createReactAgent } from "langchain";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
  });

  const tools = [new GooglePlacesAPI()];

  const executor = await createReactAgent(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const res = await executor.invoke({
    input: "Where is the University of Toronto - Scarborough? ",
  });

  console.log(res.output);
}
