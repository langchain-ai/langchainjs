import { tool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod/v3";

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

const result = await modelWithTools.invoke(
  "What's the weather like today in San Francisco? Ensure you use the 'get_current_weather' tool."
);

console.log(result);
/*
AIMessage {
  "content": "",
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
    "input_tokens": 177,
    "output_tokens": 30,
    "total_tokens": 207
  }
}
*/
