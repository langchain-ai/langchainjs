import { ChatMoonshot } from "@langchain/community/chat_models/moonshot";
import { HumanMessage } from "@langchain/core/messages";

// Default model is moonshot-v1-8k
const moonshotV18K = new ChatMoonshot({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.MOONSHOT_API_KEY
});

// Use moonshot-v1-128k
const moonshotV1128k = new ChatMoonshot({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.MOONSHOT_API_KEY
  model: "moonshot-v1-128k", // Available models: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
  temperature: 0.3,
});

const messages = [new HumanMessage("Hello")];

const res = await moonshotV18K.invoke(messages);
/*
AIMessage {
  content: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/

const res2 = await moonshotV1128k.invoke(messages);
/*
AIMessage {
  text: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/
