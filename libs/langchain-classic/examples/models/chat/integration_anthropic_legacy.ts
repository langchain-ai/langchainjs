import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  temperature: 0.9,
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ANTHROPIC_API_KEY
  maxTokensToSample: 1024,
});
