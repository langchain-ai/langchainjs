import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";
import * as dotenv from 'dotenv';
dotenv.config();

// Default model is abab5-chat
// const abab5 = new ChatMinimax({
// });

// Use ERNIE-Bot
const abab5_5= new ChatMinimax({
  modelName: "abab5.5-chat",
  proVersion: true,
  verbose: true,
});

const messages = [new HumanMessage("Hello")];

let res = await abab5_5.call(messages);
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
