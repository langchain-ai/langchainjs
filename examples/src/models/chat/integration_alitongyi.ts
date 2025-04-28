import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { HumanMessage } from "@langchain/core/messages";

// Default model is qwen-turbo
const qwenTurbo = new ChatAlibabaTongyi({
  alibabaApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ALIBABA_API_KEY
});

// Use qwen-plus
const qwenPlus = new ChatAlibabaTongyi({
  model: "qwen-plus", // Available models: qwen-turbo, qwen-plus, qwen-max
  temperature: 1,
  alibabaApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ALIBABA_API_KEY
});

const messages = [new HumanMessage("Hello")];

const res = await qwenTurbo.invoke(messages);
/*
AIMessage {
  content: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/

const res2 = await qwenPlus.invoke(messages);
/*
AIMessage {
  text: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/
