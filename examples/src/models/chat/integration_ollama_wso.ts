import { ChatOllama } from "@langchain/ollama";
import { z } from "zod/v3";

// Define the model
const model = new ChatOllama({
  model: "llama3-groq-tool-use",
});

// Define the tool schema you'd like the model to use.
const schema = z.object({
  location: z.string().describe("The city and state, e.g. San Francisco, CA"),
});

// Pass the schema to the withStructuredOutput method to bind it to the model.
const modelWithTools = model.withStructuredOutput(schema, {
  name: "get_current_weather",
});

const result = await modelWithTools.invoke(
  "What's the weather like today in San Francisco? Ensure you use the 'get_current_weather' tool."
);
console.log(result);
/*
{ location: 'San Francisco, CA' }
*/
