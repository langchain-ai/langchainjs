import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { ZepMemory } from "@langchain/community/memory/zep";
import { randomUUID } from "crypto";

const sessionId = randomUUID(); // This should be unique for each user or each user's session.
const zepURL = "http://localhost:8000";

const memory = new ZepMemory({
  sessionId,
  baseURL: zepURL,
  // This is optional. If you've enabled JWT authentication on your Zep server, you can
  // pass it in here. See https://docs.getzep.com/deployment/auth
  apiKey: "change_this_key",
});

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const chain = new ConversationChain({ llm: model, memory });
console.log("Memory Keys:", memory.memoryKeys);

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
console.log("Session ID: ", sessionId);
console.log("Memory: ", await memory.loadMemoryVariables({}));
