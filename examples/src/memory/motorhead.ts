import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { MotorheadMemory } from "@langchain/community/memory/motorhead_memory";

// Managed Example (visit https://getmetal.io to get your keys)
// const managedMemory = new MotorheadMemory({
//   memoryKey: "chat_history",
//   sessionId: "test",
//   apiKey: "MY_API_KEY",
//   clientId: "MY_CLIENT_ID",
// });

// Self Hosted Example
const memory = new MotorheadMemory({
  memoryKey: "chat_history",
  sessionId: "test",
  url: "localhost:8080", // Required for self hosted
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
