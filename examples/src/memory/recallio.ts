import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { RecallioMemory } from "@langchain/community/memory/recallio";
import { randomUUID } from "crypto";

const sessionId = randomUUID(); // This should be unique for each user or each user's session.

const memory = new RecallioMemory({
  apiKey: process.env.RECALLIO_API_KEY,
  sessionId,
});

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const chain = new ConversationChain({ llm: model, memory });
console.log("Memory Keys:", memory.memoryKeys);

const res1 = await chain.invoke({
  input: "Hi! I am Guillaume and I live in France",
});
console.log({ res1 });
/*
{
  res1: {
    response: "Hello Guillaume! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res2: {
    response: "You said your name was Guillaume."
  }
}
*/

const res3 = await chain.invoke({ input: "Where do I live?" });
console.log({ res3 });

/*
{
  res3: {
    response: "You live in France, Guillaume."
  }
}
*/

console.log("Session ID: ", sessionId);
console.log("Memory: ", await memory.loadMemoryVariables({}));
