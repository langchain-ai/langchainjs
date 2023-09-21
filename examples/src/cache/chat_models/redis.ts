import { ChatOpenAI } from "langchain/chat_models/openai";
import { RedisCache } from "langchain/cache/redis";
import { createClient } from "redis";

const client = createClient({ url: "redis://localhost:6379" });
await client.connect();

const cache = new RedisCache(client);

const model = new ChatOpenAI({ cache });
