import { ChatBedrockConverse } from "@langchain/aws";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const model = new ChatBedrockConverse({
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  },
});

const weatherTool = tool(
  ({ city, state }) => `The weather in ${city}, ${state} is 72°F and sunny`,
  {
    name: "weather_tool",
    description: "Get the weather for a city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
      state: z.string().describe("The state to get the weather for").optional(),
    }),
  }
);

const modelWithTools = model.bindTools([weatherTool]);

const res = await modelWithTools.invoke("What's the weather in New York?");
console.log(res);

/*
AIMessage {
  content: [
    {
      type: 'text',
      text: "Okay, let's get the weather for New York City."
    }
  ],
  response_metadata: { ... },
  id: '49a97da0-e971-4d7f-9f04-2495e068c15e',
  tool_calls: [
    {
      id: 'tooluse_O6Q1Ghm7SmKA9mn2ZKmBzg',
      name: 'weather_tool',
      args: {
        'city': 'New York',
      },
  ],
  usage_metadata: { input_tokens: 289, output_tokens: 68, total_tokens: 357 }
}
*/
