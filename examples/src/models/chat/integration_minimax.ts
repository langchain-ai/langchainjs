import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";
import * as dotenv from "dotenv";
import process from "process";
import { NewTokenIndices } from "langchain/callbacks";

dotenv.config();

/*
 const abab5 = new ChatMinimax({
   proVersion:false,
   modelName: "abab5-chat",
   minimaxGroupId: process.env.MINIMAX_GROUP_ID, // In Node.js defaults to process.env.MINIMAX_GROUP_ID
   minimaxApiKey: process.env.MINIMAX_API_KEY, // In Node.js defaults to process.env.MINIMAX_API_KEY
 });

 const result = await abab5.invoke([
   new HumanMessage({
     content: "Hello",
     name: "XiaoMing",
   })
 ]);
 console.log(result);

 */

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

let res = await abab5_5.invoke(messages);
console.log(res);

/*
AIChatMessage {
  text: 'Hello! How may I assist you today?',
  name: undefined,
  additional_kwargs: {}
  }
}
*/

/*

const abab5_5 = new ChatMinimax({
  streaming: true,
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ]
});
const messages = [new HumanMessage({ content: "Hello" })];

let res = await abab5_5.call(messages, {
  callbacks: [
    {
      handleLLMNewToken(token: string): Promise<void> | void {
        console.log("New token: ", token);
      },
    },
  ],
});

console.log(res);

 */

/*
New token:  Hi there! I'm an AI language
New token:   model, designed to help with various tasks and provide information. If you have any questions or need assistance
New token:  , feel free to ask!
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: "Hi there! I'm an AI language model, designed to help with various tasks and provide information. If you have any questions or need assistance, feel free to ask!",
    additional_kwargs: { function_call: undefined }
  },
  lc_namespace: [ 'langchain', 'schema' ],
  content: "Hi there! I'm an AI language model, designed to help with various tasks and provide information. If you have any questions or need assistance, feel free to ask!",
  name: undefined,
  additional_kwargs: { function_call: undefined }
}
 */
