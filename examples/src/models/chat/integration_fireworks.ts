import { ChatFireworks } from "langchain/chat_models/fireworks";

const model = new ChatFireworks({
  temperature: 0.9,
  // In Node.js defaults to process.env.FIREWORKS_API_KEY
  fireworksApiKey: "YOUR-API-KEY",
});
