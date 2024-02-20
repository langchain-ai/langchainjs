import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { AstraDBChatMessageHistory } from "@langchain/community/stores/message/astradb";

const memory = new BufferMemory({
  chatHistory: await AstraDBChatMessageHistory.initialize({
    token: process.env.ASTRA_DB_APPLICATION_TOKEN as string,
    endpoint: process.env.ASTRA_DB_ENDPOINT as string,
    namespace: process.env.ASTRA_DB_NAMESPACE,
    collectionName: "YOUR_COLLECTION_NAME",
    sessionId: "YOUR_SESSION_ID"
  })
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

// See the chat history in the MongoDb
console.log(await memory.chatHistory.getMessages());

// clear chat history
await memory.chatHistory.clear();
