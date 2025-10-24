import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.9,
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.OPENAI_API_KEY
});

// You can also pass tools or functions to the model, learn more here
// https://platform.openai.com/docs/guides/gpt/function-calling

const modelForFunctionCalling = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0,
});

await modelForFunctionCalling.invoke(
  [new HumanMessage("What is the weather in New York?")],
  {
    functions: [
      {
        name: "get_current_weather",
        description: "Get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA",
            },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
          },
          required: ["location"],
        },
      },
    ],
    // You can set the `function_call` arg to force the model to use a function
    function_call: {
      name: "get_current_weather",
    },
  }
);
/*
AIMessage {
  text: '',
  name: undefined,
  additional_kwargs: {
    function_call: {
      name: 'get_current_weather',
      arguments: '{\n  "location": "New York"\n}'
    }
  }
}
*/

// Coerce response type with JSON mode.
// Requires "gpt-4-1106-preview" or later
const jsonModeModel = new ChatOpenAI({
  model: "gpt-4-1106-preview",
  maxTokens: 128,
}).withConfig({
  response_format: {
    type: "json_object",
  },
});

// Must be invoked with a system message containing the string "JSON":
// https://platform.openai.com/docs/guides/text-generation/json-mode
const res = await jsonModeModel.invoke([
  ["system", "Only return JSON"],
  ["human", "Hi there!"],
]);
console.log(res);

/*
  AIMessage {
    content: '{\n  "response": "How can I assist you today?"\n}',
    name: undefined,
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  }
*/
