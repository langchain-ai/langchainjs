"use node";

import { ConvexVectorStore } from "langchain/vectorstores/convex";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { v } from "convex/values";
import { action } from "./_generated/server.js";

export const search = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const vectorStore = new ConvexVectorStore(new OpenAIEmbeddings(), { ctx });

    const resultOne = await vectorStore.similaritySearch(args.query, 1);
    console.log(resultOne);
  },
});
