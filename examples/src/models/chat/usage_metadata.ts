import { ChatOpenAI } from "@langchain/openai";

const chatModel = new ChatOpenAI({
  model: "gpt-3.5-turbo-0125",
});

const res = await chatModel.invoke("Tell me a joke.");

console.log(res.usage_metadata);

/*
  { input_tokens: 12, output_tokens: 17, total_tokens: 29 }
*/
