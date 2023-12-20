import { ChatAnthropicMessages } from "@langchain/anthropic";

const model = new ChatAnthropicMessages({
  temperature: 0.9,
  anthropicApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.ANTHROPIC_API_KEY,
  maxTokens: 1024,
});
