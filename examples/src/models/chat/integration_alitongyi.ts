import { ChatAliTongyi } from "langchain/chat_models/alitongyi";
import { HumanMessage } from "langchain/schema";

// Default model is qwen-turbo
const qwenTurbo = new ChatAliTongyi({
  aliApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ALI_API_KEY
});

// Use qwen-plus
const qwenPlus = new ChatAliTongyi({
  modelName: "qwen-plus", // Available models: qwen-turbo, qwen-plus, qwen-max
  temperature: 1,
  aliApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ALI_API_KEY
});

const messages = [new HumanMessage("Hello")];

let res = await qwenTurbo.call(messages);
/*
AIMessage {
  content: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/

res = await qwenPlus.call(messages);
/*
AIMessage {
  text: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/
