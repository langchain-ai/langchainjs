import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";
import * as dotenv from "dotenv";

dotenv.config();

// Default model is abab5-chat
// const abab5 = new ChatMinimax({
// });

// Use abab5.5
// const abab5_5 = new ChatMinimax({
//   modelName: "abab5.5-chat",
//   proVersion: true,
//   verbose: true,
//   botSetting: [
//     {
//       bot_name: "MM Assistant",
//       content:
//         " MM Intelligent Assistant is a large-scale language model independently developed by Mini Max, answering questions concisely and logically without calling other product interfaces. Mini Max is a Chinese technology company dedicated to research related to large models.",
//     },
//   ],
//   replyConstraints: {
//     sender_type: "BOT",
//     sender_name: "MM Assistant",
//   },
// });
//
// const messages = [new HumanMessage({ content: "Hello", name: "User" })];
//
// let res = await abab5_5.call(messages);
// console.log(res);

/*
AIChatMessage {
  text: 'Hello! How may I assist you today?',
  name: undefined,
  additional_kwargs: {}
  }
}
*/

// Use abab5.5 with plugins
const abab5_5WithPlugins = new ChatMinimax({
  modelName: "abab5.5-chat",
  proVersion: true,
  verbose: true,
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).bind({
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
  },
});
const messages = [
  new HumanMessage({
    content: " What is the weather like in Shanghai tomorrow?",
    name: "XiaoMing",
  }),
];

let res = await abab5_5WithPlugins.invoke(messages);
console.log(res);

/*
AIChatMessage {
  text: 'Hello! How may I assist you today?',
  name: undefined,
  additional_kwargs: {}
  }
}
*/

// res = await ernie.call(messages);
/*
AIChatMessage {
  text: 'Hello! How may I assist you today?',
  name: undefined,
  additional_kwargs: {}
  }
}
*/
