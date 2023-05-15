import { createClient } from "redis";
import { BufferMemory } from "langchain/memory";
import { RedisChatMessageHistory } from "langchain/stores/message/redis";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";

const client = createClient({
  url: "redis://localhost:6379",
});

const memory = new BufferMemory({
  chatHistory: new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
    sessionTTL: 300,
    client,
  }),
});

const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
});

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
