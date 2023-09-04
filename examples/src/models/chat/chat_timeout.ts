import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage } from "langchain/schema";

const chat = new ChatOpenAI({ temperature: 1 });

const response = await chat.call(
  [
    new HumanMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ],
  { timeout: 1000 } // 1s timeout
);
console.log(response);
// AIMessage { text: '\n\nRainbow Sox Co.' }
