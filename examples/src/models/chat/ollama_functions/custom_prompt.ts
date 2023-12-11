import { OllamaFunctions } from "langchain/experimental/chat_models/ollama_functions";
import { HumanMessage } from "langchain/schema";

// Custom system prompt to format tools. You must encourage the model
// to wrap output in a JSON object with "tool" and "tool_input" properties.
const toolSystemPromptTemplate = `You have access to the following tools:

{tools}

To use a tool, respond with a JSON object with the following structure:
{{
  "tool": <name of the called tool>,
  "tool_input": <parameters for the tool matching the above JSON schema>
}}`;

const model = new OllamaFunctions({
  temperature: 0.1,
  model: "mistral",
  toolSystemPromptTemplate,
}).bind({
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
});

const response = await model.invoke([
  new HumanMessage({
    content: "What's the weather in Boston?",
  }),
]);

console.log(response);

/*
  AIMessage {
    content: '',
    additional_kwargs: {
      function_call: {
        name: 'get_current_weather',
        arguments: '{"location":"Boston, MA","unit":"fahrenheit"}'
      }
    }
  }
*/
