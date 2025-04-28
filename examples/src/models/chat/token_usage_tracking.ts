import { ChatOpenAI } from "@langchain/openai";

const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const res = await chatModel.invoke("Tell me a joke.");

console.log(res.response_metadata);

/*
  {
    tokenUsage: { completionTokens: 15, promptTokens: 12, totalTokens: 27 },
    finish_reason: 'stop'
  }
*/
