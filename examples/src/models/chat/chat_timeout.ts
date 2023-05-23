import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage } from "langchain/schema";

const chat = new ChatOpenAI({ temperature: 1 });

const response = await chat.call(
  [
    new HumanChatMessage(
      "What is a good name for a company that makes colorful socks?"
    ),
  ],
  { timeout: 1000 } // 1s timeout
);
console.log(response);
// AIChatMessage { text: '\n\nRainbow Sox Co.' }
