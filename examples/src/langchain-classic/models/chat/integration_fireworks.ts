import { ChatFireworks } from "@langchain/community/chat_models/fireworks";

const model = new ChatFireworks({
  temperature: 0.9,
  // In Node.js defaults to process.env.FIREWORKS_API_KEY
  apiKey: "YOUR-API-KEY",
});
