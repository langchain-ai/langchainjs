import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";

const messageHistory = [
  new HumanMessage("What's the weather like today in Paris?"),
  new AIMessage({
    content: "",
    tool_calls: [
      {
        id: "89a1e453-0bce-4de3-a456-c54bed09c520",
        name: "get_current_weather",
        args: {
          location: "Paris, France",
        },
      },
    ],
  }),
  new ToolMessage({
    tool_call_id: "89a1e453-0bce-4de3-a456-c54bed09c520",
    content: "22",
  }),
  new AIMessage("The weather in Paris is 22 degrees."),
  new HumanMessage(
    "What's the weather like today in San Francisco? Ensure you use the 'get_current_weather' tool."
  ),
];

const weatherTool = tool((_) => "Da weather is weatherin", {
  name: "get_current_weather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  }),
});

// Define the model
const model = new ChatOllama({
  model: "llama3-groq-tool-use",
});

// Bind the tool to the model
const modelWithTools = model.bindTools([weatherTool]);

const result = await modelWithTools.invoke(messageHistory);

console.log(result);
/*
AIMessage {
  "tool_calls": [
    {
      "name": "get_current_weather",
      "args": {
        "location": "San Francisco, CA"
      },
      "type": "tool_call"
    }
  ],
  "usage_metadata": {
    "input_tokens": 223,
    "output_tokens": 20,
    "total_tokens": 243
  }
}
*/
