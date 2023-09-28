import { Redis } from "@upstash/redis";
import https from "https";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { UpstashRedisCache } from "langchain/cache/upstash_redis";

// const client = new Redis({
//   url: process.env.UPSTASH_REDIS_REST_URL!,
//   token: process.env.UPSTASH_REDIS_REST_TOKEN!,
//   agent: new https.Agent({ keepAlive: true }),
// });

// Or simply call Redis.fromEnv() to automatically load the UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.
const client = Redis.fromEnv({
  agent: new https.Agent({ keepAlive: true }),
});

const cache = new UpstashRedisCache({ client });
const model = new ChatOpenAI({ cache });
