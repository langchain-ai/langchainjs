import { ChatBedrockConverse } from "@langchain/aws";
import { z } from "zod/v3";

const model = new ChatBedrockConverse({
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  },
});

const weatherSchema = z
  .object({
    city: z.string().describe("The city to get the weather for"),
    state: z.string().describe("The state to get the weather for").optional(),
  })
  .describe("Get the weather for a city");

const modelWithStructuredOutput = model.withStructuredOutput(weatherSchema, {
  name: "weather_tool", // Optional, defaults to 'extract'
});

const res = await modelWithStructuredOutput.invoke(
  "What's the weather in New York?"
);
console.log(res);

/*
{ city: 'New York', state: 'NY' }
*/
