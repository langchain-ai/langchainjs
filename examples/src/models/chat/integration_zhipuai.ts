import { ChatZhipuAI } from "@langchain/community/chat_models/zhipuai";
import { HumanMessage } from "@langchain/core/messages";

// Default model is glm-3-turbo
const glm3turbo = new ChatZhipuAI({
  zhipuAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ZHIPUAI_API_KEY
});

// Use glm-4
const glm4 = new ChatZhipuAI({
  model: "glm-4", // Available models:
  temperature: 1,
  zhipuAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ZHIPUAI_API_KEY
});

const messages = [new HumanMessage("Hello")];

const res = await glm3turbo.invoke(messages);
/*
AIMessage {
  content: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/

const res2 = await glm4.invoke(messages);
/*
AIMessage {
  text: "Hello! How can I help you today? Is there something you would like to talk about or ask about? I'm here to assist you with any questions you may have.",
}
*/
