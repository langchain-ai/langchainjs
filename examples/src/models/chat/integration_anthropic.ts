import { ChatAnthropic } from "langchain/chat_models/anthropic";

const model = new ChatAnthropic({
  temperature: 0.9,
  anthropicApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ANTHROPIC_API_KEY
});
