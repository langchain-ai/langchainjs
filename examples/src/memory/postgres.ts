import { BufferMemory } from "langchain/memory";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { v4 as uuidv4 } from "uuid";

const chatHistory = new PostgresChatMessageHistory({
  sessionId: uuidv4(),
  poolConfig: {
    host: "127.0.0.1",
    port: 5432,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  },
  // pool: <your pool here> instead of poolConfig
});

const memory = new BufferMemory({
  chatHistory,
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

// If you provided a pool config you can close the created pool when you are done
await chatHistory.end();
