import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatTogetherAI({
  temperature: 0.9,
  // In Node.js defaults to process.env.TOGETHER_AI_API_KEY
  apiKey: "YOUR-API-KEY",
});

console.log(await model.invoke([new HumanMessage("Hello there!")]));
