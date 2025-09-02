import { GooglePlacesAPI } from "@langchain/community/tools/google_places";
import { OpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
  });

  const tools = [new GooglePlacesAPI()];

  const executor = await createAgent({
    llm: model,
    tools,
    name: "zero-shot-react-description",
  });

  const res = await executor.invoke({
    messages: ["Where is the University of Toronto - Scarborough? "],
  });

  console.log(res.messages.at(-1)?.content);
}
