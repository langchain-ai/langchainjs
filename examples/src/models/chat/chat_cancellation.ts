import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage } from "langchain/schema";

const model = new ChatOpenAI({ temperature: 1 });
const controller = new AbortController();

// Call `controller.abort()` somewhere to cancel the request.

const res = await model.call(
  [
    new HumanChatMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ],
  { signal: controller.signal }
);

console.log(res);
/*
'\n\nSocktastic Colors'
*/
