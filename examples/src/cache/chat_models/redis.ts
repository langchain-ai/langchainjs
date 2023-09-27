import { ChatOpenAI } from "langchain/chat_models/openai";
import { RedisCache } from "langchain/cache/ioredis";
import { Redis } from "ioredis";

const client = new Redis("redis://localhost:6379");

const cache = new RedisCache(client, {
  ttl: 60, // Optional key expiration value
});

const model = new ChatOpenAI({ cache });

const response1 = await model.invoke("Do something random!");
console.log(response1);
/*
  AIMessage {
    content: "Sure! I'll generate a random number for you: 37",
    additional_kwargs: {}
  }
*/

const response2 = await model.invoke("Do something random!");
console.log(response2);
/*
  AIMessage {
    content: "Sure! I'll generate a random number for you: 37",
    additional_kwargs: {}
  }
*/

await client.disconnect();
