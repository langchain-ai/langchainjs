import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";

const functionSchema = {
  name: "get_weather",
  description: " Get weather information.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: " The location to get the weather",
      },
    },
    required: ["location"],
  },
};

// Bind function arguments to the model.
// All subsequent invoke calls will use the bound parameters.
// "functions.parameters" must be formatted as JSON Schema
const model = new ChatMinimax({
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).bind({
  functions: [functionSchema],
});

const result = await model.invoke([
  new HumanMessage({
    content: " What is the weather like in NewYork tomorrow?",
    name: "I",
  }),
]);

console.log(result);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: { content: '', additional_kwargs: { function_call: [Object] } },
  lc_namespace: [ 'langchain', 'schema' ],
  content: '',
  name: undefined,
  additional_kwargs: {
    function_call: { name: 'get_weather', arguments: '{"location": "NewYork"}' }
  }
}
*/

// Alternatively, you can pass function call arguments as an additional argument as a one-off:

const minimax = new ChatMinimax({
  modelName: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
});

const result2 = await minimax.call(
  [new HumanMessage("What is the weather like in NewYork tomorrow?")],
  {
    functions: [functionSchema],
  }
);
console.log(result2);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: { content: '', additional_kwargs: { function_call: [Object] } },
  lc_namespace: [ 'langchain', 'schema' ],
  content: '',
  name: undefined,
  additional_kwargs: {
    function_call: { name: 'get_weather', arguments: '{"location": "NewYork"}' }
  }
}
 */
