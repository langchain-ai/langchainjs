import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";

const model = new ChatTogetherAI({
  temperature: 0.9,
  // In Node.js defaults to process.env.TOGETHER_AI_API_KEY
  togetherAIApiKey: "YOUR-API-KEY",
});
