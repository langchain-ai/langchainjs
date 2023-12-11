"use node";

import { v } from "convex/values";
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";
import { ConvexChatMessageHistory } from "langchain/stores/message/convex";
import { action } from "./_generated/server.js";

export const ask = action({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // pass in a sessionId string
    const { sessionId } = args;

    const memory = new BufferMemory({
      chatHistory: new ConvexChatMessageHistory({ sessionId, ctx }),
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

    const res2 = await chain.call({
      input: "What did I just say my name was?",
    });
    console.log({ res2 });

    /*
      {
        res2: {
          text: "You said your name was Jim."
        }
      }
    */

    // See the chat history in the Convex database
    console.log(await memory.chatHistory.getMessages());

    // clear chat history
    await memory.chatHistory.clear();
  },
});
