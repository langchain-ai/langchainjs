import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";

const extractionFunctionSchema = {
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
// Omit "function_call" if you want the model to choose a function to call.
const model = new ChatMinimax({
  modelName: "abab5.5-chat",
  proVersion: true,
  verbose: true,
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
  },
}).bind({
  functions: [extractionFunctionSchema],
});

const result = await model.invoke([
  new HumanMessage({
    content: " What is the weather like in Shanghai tomorrow?",
    name: "XiaoMing",
  }),
]);
result.additional_kwargs.function_call

console.log(result);

/*
  AIMessage {
    content: '',
    name: undefined,
    additional_kwargs: {
      function_call: {
        name: 'extractor',
        arguments: '{\n' +
          '  "tone": "positive",\n' +
          '  "word_count": 4,\n' +
          '  "chat_response": "It certainly is a beautiful day!"\n' +
          '}'
      }
    }
  }
*/

// Alternatively, you can pass function call arguments as an additional argument as a one-off:
/*
const model = new ChatOpenAI({
  modelName: "gpt-4",
});

const result = await model.call([
  new HumanMessage("What a beautiful day!")
], {
  functions: [extractionFunctionSchema],
  function_call: {name: "extractor"}
});
*/
