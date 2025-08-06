import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { Mem0Memory } from "@langchain/community/memory/mem0";
import { randomUUID } from "crypto";

const sessionId = randomUUID(); // This should be unique for each user or each user's session.

const memory = new Mem0Memory({
  apiKey: "your-api-key",
  sessionId,
  memoryOptions: {
    run_id: "run123", // Optional, if you want to save the conversation to a specific run.
  },
});

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const chain = new ConversationChain({ llm: model, memory });
console.log("Memory Keys:", memory.memoryKeys);

const res1 = await chain.invoke({
  input: "Hi! I am Jim and I live in Finland",
});
console.log({ res1 });
/*
{
  res1: {
    response: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res2: {
    response: "You said your name was Jim."
  }
}
*/

const res3 = await chain.invoke({ input: "Where do I live?" });
console.log({ res3 });

/*
{
  res3: {
    response: "You live in Finland, Jim."
  }
}
*/

console.log("Session ID: ", sessionId);
console.log("Memory: ", await memory.loadMemoryVariables({}));
