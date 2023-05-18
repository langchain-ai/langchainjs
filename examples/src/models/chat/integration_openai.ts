import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
  temperature: 0.9,
  openAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.OPENAI_API_KEY
});
