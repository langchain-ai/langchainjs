import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";
import * as dotenv from 'dotenv';
dotenv.config();

// Default model is abab5-chat
const ernieTurbo = new ChatMinimax({
  minimaxApiKey:process.env.MINIMAX_API_KEY, // In Node.js defaults to process.env.MINIMAX_API_KEY
  minimaxGroupId:process.env.MINIMAX_GROUP_ID, // In Node.js defaults to process.env.MINIMAX_GROUP_ID
  verbose: true,
});

// Use ERNIE-Bot
// const ernie = new ChatBaiduWenxin({
//   modelName: "ERNIE-Bot",
//   temperature: 1, // Only ERNIE-Bot supports temperature
//   baiduApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.BAIDU_API_KEY
//   baiduSecretKey: "YOUR-SECRET-KEY", // In Node.js defaults to process.env.BAIDU_SECRET_KEY
// });

const messages = [new HumanMessage("Hello")];

let res = await ernieTurbo.call(messages);
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
