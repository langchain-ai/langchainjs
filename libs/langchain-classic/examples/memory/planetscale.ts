import { BufferMemory } from "langchain/memory";
import { PlanetScaleChatMessageHistory } from "@langchain/community/stores/message/planetscale";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

const memory = new BufferMemory({
  chatHistory: new PlanetScaleChatMessageHistory({
    tableName: "stored_message",
    sessionId: "lc-example",
    config: {
      url: "ADD_YOURS_HERE", // Override with your own database instance's URL
    },
  }),
});

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
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
