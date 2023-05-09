import { BufferMemory } from "langchain/memory";
import { RedisChatMemory } from "langchain/stores/message/redis";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";
import { createClient, RedisClientType } from "redis";

const client = createClient();

const memory = new BufferMemory({
  chatHistory: new RedisChatMemory(client as RedisClientType, {
    sessionId: "four",
    // redisUrl: "redis://localhost:6379", This is the default, but you can specify any URL you want
  }),
});

const model = new ChatOpenAI();
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.call({ input: "Hi! I'm Jim." });
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.call({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jim."
  }
}
*/
