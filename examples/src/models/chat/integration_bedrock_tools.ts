import { BedrockChat } from "@langchain/community/chat_models/bedrock";
// Or, from web environments:
// import { BedrockChat } from "@langchain/community/chat_models/bedrock/web";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const model = new BedrockChat({
  region: process.env.BEDROCK_AWS_REGION,
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  maxRetries: 0,
  credentials: {
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
  },
});

const weatherSchema = z
  .object({
    city: z.string().describe("The city to get the weather for"),
    state: z.string().describe("The state to get the weather for").optional(),
  })
  .describe("Get the weather for a city");

const modelWithTools = model.bindTools([
  {
    name: "weather_tool",
    description: weatherSchema.description,
    input_schema: zodToJsonSchema(weatherSchema),
  },
]);

const res = await modelWithTools.invoke("What's the weather in New York?");
console.log(res);

/*
AIMessage {
  additional_kwargs: { id: 'msg_bdrk_01JF7hb4PNQPywP4gnBbgpHi' },
  response_metadata: {
    stop_reason: 'tool_use',
    usage: { input_tokens: 300, output_tokens: 85 }
  },
  tool_calls: [
    {
      name: 'weather_tool',
      args: {
        city: 'New York',
        state: 'NY'
      },
      id: 'toolu_bdrk_01AtEZRTCKioFXqhoNcpgaV7'
    }
  ],
}
*/
