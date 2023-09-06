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

const model = new ChatMinimax({
  modelName: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).bind({
  functions: [
    {
      name: "get_weather",
      description: " Get weather information.",
      parameters: zodToJsonSchema(extractionFunctionZodSchema),
    },
  ],
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
  lc_serializable: true,
  lc_kwargs: { content: '', additional_kwargs: { function_call: [Object] } },
  lc_namespace: [ 'langchain', 'schema' ],
  content: '',
  name: undefined,
  additional_kwargs: {
    function_call: { name: 'get_weather', arguments: '{"location": "Shanghai"}' }
  }
}
*/
