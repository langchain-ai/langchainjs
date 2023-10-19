import { ChatOpenAI } from "langchain/chat_models/openai";
import { UpstashRedisCache } from "langchain/cache/upstash_redis";

// See https://docs.upstash.com/redis/howto/connectwithupstashredis#quick-start for connection options
const cache = new UpstashRedisCache({
  config: {
    url: "UPSTASH_REDIS_REST_URL",
    token: "UPSTASH_REDIS_REST_TOKEN",
  },
});

const model = new ChatOpenAI({ cache });
