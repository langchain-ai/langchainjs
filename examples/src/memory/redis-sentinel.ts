import { Redis } from "ioredis";
import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "@langchain/community/stores/message/ioredis";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

// Uses ioredis to facilitate Sentinel Connections see their docs for details on setting up more complex Sentinels: https://github.com/redis/ioredis#sentinel
const client = new Redis({
  sentinels: [
    { host: "localhost", port: 26379 },
    { host: "localhost", port: 26380 },
  ],
  name: "mymaster",
});

const memory = new BufferMemory({
  chatHistory: new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
    sessionTTL: 300,
    client,
  }),
});

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.5 });

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
