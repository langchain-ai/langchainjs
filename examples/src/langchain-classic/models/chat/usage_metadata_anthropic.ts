import { ChatAnthropic } from "@langchain/anthropic";

const chatModel = new ChatAnthropic({
  model: "claude-3-haiku-20240307",
});

const res = await chatModel.invoke("Tell me a joke.");

console.log(res.usage_metadata);

/*
  { input_tokens: 12, output_tokens: 98, total_tokens: 110 }
*/
