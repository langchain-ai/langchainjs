import { HumanMessage } from "langchain/schema";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatMinimax } from "langchain/chat_models/minimax";

const extractionFunctionZodSchema = z.object({
  location: z.string().describe(" The location to get the weather"),
});

// Bind function arguments to the model.
// "functions.parameters" must be formatted as JSON Schema.
// We translate the above Zod schema into JSON schema using the "zodToJsonSchema" package.
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
  ]
}).bind({
  functions: [
    {
      name: "get_weather",
      description: " Get weather information.",
      parameters: zodToJsonSchema(extractionFunctionZodSchema),
    },
  ],
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
  }
});

const result = await model.invoke([
  new HumanMessage({
    content: " What is the weather like in Shanghai tomorrow?",
    name: "XiaoMing",
  }),
]);

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
          '  "entity": "day",\n' +
          '  "word_count": 4,\n' +
          '  "chat_response": "It certainly is a gorgeous day!",\n' +
          '  "final_punctuation": "!"\n' +
          '}'
      }
    }
  }
*/
