import { ChatOVHCloudAIEndpoints } from "@langchain/community/chat_models/ovhcloud";

const model = new ChatOVHCloudAIEndpoints({
  // In Node.js defaults to process.env.OVHCLOUD_AI_ENDPOINTS_API_KEY
  apiKey: "your-api-key",
  model: "your-model-name",
});
