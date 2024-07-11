import { ChatBedrockConverse } from "@langchain/aws";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
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

// Define two tools. The `weather_tool`, which will have already been called
// and the result will be an error. Next, the `error_handler_tool` will be
// provided to the model to handle the error.

const weatherTool = tool(
  (_) => {
    return ""; // no-op, we won't actually invoke the tools in this example
  },
  {
    name: "weather_tool",
    description: "Fetches the weather for a given location.",
    schema: z.object({
      location: z.string().describe("The location to fetch the weather for."),
    }),
  }
);
const errorHandlerTool = tool(
  (_) => {
    return ""; // no-op, we won't actually invoke the tools in this example
  },
  {
    name: "error_handler_tool",
    description: "A tool which handles any errors in the conversation.",
    schema: z.object({
      errorMessage: z.string().describe("The error message to handle."),
    }),
  }
);

// Define an array of messages to simulate a conversation history.
// Ensure the `ToolMessage` has a status if "error" to indicate to
// the model that an error occurred.
const messageHistory = [
  new SystemMessage(`You are a helpful AI agent.`),
  new HumanMessage("What's the weather like in New York, NY?"),
  new AIMessage({
    content: "",
    tool_calls: [
      {
        name: "weather_tool",
        args: {
          location: "New York, NY",
        },
        id: "tool_call_1",
      },
    ],
  }),
  new ToolMessage({
    content: "An error occurred while trying to fetch the weather.",
    tool_call_id: "tool_call_1",
    raw_output: {
      status: "error",
    },
  }),
];

// Bind both tools to the model.
const modelWithTools = model.bindTools([weatherTool, errorHandlerTool]);

const res = await modelWithTools.invoke(messageHistory);
console.log(JSON.stringify(res, null, 2));

/*
{
  "content": [
    {
      "type": "text",
      "text": "It seems there was an issue fetching the weather for New York, NY. Let me try handling the error:"
    }
  ],
  "tool_calls": [
    {
      "id": "tooluse__pIOAIE6QUy8g6gAo_YyqA",
      "name": "error_handler_tool",
      "args": {
        "errorMessage": "An error occurred while trying to fetch the weather."
      }
    }
  ],
  "response_metadata": { ... },
  "usage_metadata": { ... },
  "id": "53eb9f1c-b874-4c9a-a476-d1c77c0bea77",
}
*/
