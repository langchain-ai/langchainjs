import { RedisChatMessageHistory } from "langchain/stores/message/redis";

const chatHistory = new RedisChatMessageHistory({
  sessionId: new Date().toISOString(), // Or some other unique identifier for the conversation
  sessionTTL: 300, // 5 minutes, omit this parameter to make sessions never expire
  config: {
    url: "redis://localhost:6379", // Default value, override with your own instance's URL
  },
});

// Clear all entries in the Redis instance
await chatHistory.client.flushDb();
