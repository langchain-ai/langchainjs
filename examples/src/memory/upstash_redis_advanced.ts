import { Redis } from "@upstash/redis";
import { BufferMemory } from "langchain/memory";
import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

// Create your own Redis client
const client = new Redis({
  url: "https://ADD_YOURS_HERE.upstash.io",
  token: "********",
});

const memory = new BufferMemory({
  chatHistory: new UpstashRedisChatMessageHistory({
    sessionId: new Date().toISOString(),
    sessionTTL: 300,
    client, // You can reuse your existing Redis client
  }),
});

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jim."
  }
}
*/
