import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";
import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";

const model = new ChatCloudflareWorkersAI({
  model: "@hf/nousresearch/hermes-2-pro-mistral-7b",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  // Pass a custom base URL to use Cloudflare AI Gateway
  // baseUrl: `https://gateway.ai.cloudflare.com/v1/{YOUR_ACCOUNT_ID}/{GATEWAY_NAME}/workers-ai/`,
});

const weatherSchema = z.object({
  location: z.string().describe("The location to get the weather for"),
});

const modelWithTools = model.withStructuredOutput(weatherSchema, {
  name: "get_weather",
});

const inputMessages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("What's the weather like in the North Pole?"),
];

const response = await modelWithTools.invoke(inputMessages);

console.log(response);

/*
{ location: 'North Pole' }
*/
