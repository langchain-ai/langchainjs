import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage } from "langchain/schema";
import { SerpAPI } from "langchain/tools";

const model = new ChatOpenAI({
  temperature: 0.9,
  openAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.OPENAI_API_KEY
});

// You can also pass tools or functions to the model, learn more here
// https://platform.openai.com/docs/guides/gpt/function-calling

const modelForFunctionCalling = new ChatOpenAI({
  modelName: "gpt-4-0613",
  temperature: 0,
});

await modelForFunctionCalling.predictMessages(
  [new HumanMessage("What is the weather in New York?")],
  { tools: [new SerpAPI()] }
  // Tools will be automatically formatted as functions in the OpenAI format
);
/*
AIMessage {
  text: '',
  name: undefined,
  additional_kwargs: {
    function_call: {
      name: 'search',
      arguments: '{\n  "input": "current weather in New York"\n}'
    }
  }
}
*/

await modelForFunctionCalling.predictMessages(
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
      arguments: "",
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
