import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";

// Use abab5.5
const abab5_5 = new ChatMinimax({
  modelName: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
});
const messages = [
  new HumanMessage({
    content: "Hello",
  }),
];

const res = await abab5_5.invoke(messages);
console.log(res);

/*
AIChatMessage {
  text: 'Hello! How may I assist you today?',
  name: undefined,
  additional_kwargs: {}
  }
}
*/

// use abab5
const abab5 = new ChatMinimax({
  proVersion: false,
  modelName: "abab5-chat",
  minimaxGroupId: process.env.MINIMAX_GROUP_ID, // In Node.js defaults to process.env.MINIMAX_GROUP_ID
  minimaxApiKey: process.env.MINIMAX_API_KEY, // In Node.js defaults to process.env.MINIMAX_API_KEY
});

const result = await abab5.invoke([
  new HumanMessage({
    content: "Hello",
    name: "XiaoMing",
  }),
]);
console.log(result);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: 'Hello! Can I help you with anything?',
    additional_kwargs: { function_call: undefined }
  },
  lc_namespace: [ 'langchain', 'schema' ],
  content: 'Hello! Can I help you with anything?',
  name: undefined,
  additional_kwargs: { function_call: undefined }
}
 */
