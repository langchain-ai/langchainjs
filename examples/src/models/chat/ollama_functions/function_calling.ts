import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatOllama({
  temperature: 0.1,
  model: "mistral",
})
  .bindTools([
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
  ])
  .withConfig({
    // You can set the `tool_choice` arg to force the model to use a function
    tool_choice: "get_current_weather",
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
