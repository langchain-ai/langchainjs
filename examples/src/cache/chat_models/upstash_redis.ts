import { ChatOpenAI } from "@langchain/openai";
import { UpstashRedisCache } from "@langchain/community/caches/upstash_redis";

// See https://docs.upstash.com/redis/howto/connectwithupstashredis#quick-start for connection options
const cache = new UpstashRedisCache({
  config: {
    url: "UPSTASH_REDIS_REST_URL",
    token: "UPSTASH_REDIS_REST_TOKEN",
  },
  ttl: 3600,
});

const model = new ChatOpenAI({ model: "gpt-4o-mini", cache });
