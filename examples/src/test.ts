import { ChatBedrockConverse } from "@langchain/aws";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const model = new ChatBedrockConverse({
  region: process.env.BEDROCK_AWS_REGION ?? "us-east-1",
  credentials: {
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
  },
  maxRetries: 1,
});


const retrieverTool = tool((_) => {
  console.log("Called");
  return "Success"
}, {
  name: "retrieverTool",
  schema: z.object({
    url: z.string().describe("The URL to fetch"),
  }),
  description: "A tool to fetch data from a URL",
})

const messages = [
  new SystemMessage("You're an advanced AI assistant."),
  new HumanMessage("What's the weather like today in Berkeley, CA? Use weather.com to check."),
  new AIMessage({
    content: "",
    tool_calls: [{
      name: "retrieverTool",
      args: {
        url: "https://weather.com",
      },
    }]
  }),
  new ToolMessage({
    tool_call_id: "123_retriever_tool",
    content: "The weather in Berkeley, CA is 70 degrees and sunny."
  })
]

const modelWithTools = model.bindTools([retrieverTool]);

const result = await modelWithTools.invoke(messages);

console.log(result);