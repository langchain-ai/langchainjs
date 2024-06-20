import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";
import { AIMessageChunk, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const model = new ChatCloudflareWorkersAI({
  model: "@cf/meta/llama-2-7b-chat-int8", // Default value
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  // Pass a custom base URL to use Cloudflare AI Gateway
  // baseUrl: `https://gateway.ai.cloudflare.com/v1/{YOUR_ACCOUNT_ID}/{GATEWAY_NAME}/workers-ai/`,
});

const weatherSchema = z.object({
  location: z.string().describe("The location to get the weather for"),
});
const weatherTool = tool<typeof weatherSchema>((input) => {
  return `The weather in ${input.location} is sunny.`;
}, {
  name: "get_weather",
  description: "Get the weather",
});

const modelWithTools = model.bindTools([weatherTool]);

const inputMessages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("What's the weather like in the North Pole?")
];

const response = await modelWithTools.invoke(inputMessages);

console.log(response.tool_calls);

/*

*/

const stream = await model.stream(inputMessages);

let finalChunk: AIMessageChunk | undefined = undefined;
for await (const chunk of stream) {
  console.log(chunk.content);
  if (!finalChunk) {
    finalChunk = chunk;
  } else {
    finalChunk = finalChunk.concat(chunk);
  }
}

console.log(finalChunk?.tool_calls)

/*
*/
