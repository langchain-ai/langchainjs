import { v } from "convex/values";
import { ChatOpenAI } from "../../../../chat_models/openai.js";
import { ConversationChain } from "../../../../chains/conversation.js";
import { BufferMemory } from "../../../../memory/buffer_memory.js";
import { ConvexChatMessageHistory } from "../../../../stores/message/convex.js";
import { action, mutation } from "./_generated/server.js";

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("messages").collect();
    await Promise.all(documents.map((document) => ctx.db.delete(document._id)));
  },
});

export const chat = action({
  args: {
    openAIApiKey: v.string(),
    sessionId: v.string(),
    input: v.string(),
  },
  handler: async (ctx, { openAIApiKey, sessionId, input }) => {
    const memory = new BufferMemory({
      chatHistory: new ConvexChatMessageHistory({
        ctx,
        sessionId,
      }),
    });

    const model = new ChatOpenAI({
      openAIApiKey,
      modelName: "gpt-3.5-turbo",
      temperature: 0,
    });
    const chain = new ConversationChain({ llm: model, memory });
    return await chain.call({ input });
  },
});
