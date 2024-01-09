import { OllamaFunctions } from "langchain/experimental/chat_models/ollama_functions";
import { HumanMessage } from "@langchain/core/messages";

const chat = new OllamaFunctions({
  model: "mistral",
  temperature: 0.1,
  stop: ["\n\n\n"],
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
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
          },
        },
        required: ["location"],
      },
    },
  ],
});
const message = new HumanMessage("What is the weather in San Francisco?");
const stream = await chat.stream([message]);

let response;
for await (const chunk of stream) {
  console.log(chunk);
  if (!response) {
    response = chunk;
  } else {
    response = response.concat(chunk);
  }
}
console.log(JSON.stringify(response));
