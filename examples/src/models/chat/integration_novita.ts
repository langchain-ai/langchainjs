import { ChatNovita } from "@langchain/community/chat_models/novita";
import { HumanMessage } from "@langchain/core/messages";

// Use gryphe/mythomax-l2-13b
const chat = new ChatNovita({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.NOVITA_API_KEY
  model: "gryphe/mythomax-l2-13b", // Check available models at https://novita.ai/llm-api
  temperature: 0.3,
});

const messages = [new HumanMessage("Hello")];

const res = await chat.invoke(messages);
/*
AIMessage {
  content: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/

const res2 = await chat.invoke(messages);
/*
AIMessage {
  text: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/
