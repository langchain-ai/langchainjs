// eslint-disable-next-line import/no-extraneous-dependencies
import { v } from "convex/values";
import { ConvexVectorStore } from "../../../convex.js";
import { action, mutation } from "./_generated/server.js";
import { FakeEmbeddings } from "../../../../utils/testing.js";

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("documents").collect();
    await Promise.all(documents.map((document) => ctx.db.delete(document._id)));
  },
});

export const ingest = action({
  args: {
    openAIApiKey: v.string(),
    texts: v.array(v.string()),
    metadatas: v.array(v.any()),
  },
  handler: async (ctx, { texts, metadatas }) => {
    await ConvexVectorStore.fromTexts(
      texts,
      metadatas,
      new FakeEmbeddings({}),
      { ctx }
    );
  },
});

export const similaritySearch = action({
  args: {
    openAIApiKey: v.string(),
    query: v.string(),
  },
  handler: async (ctx, { query }) => {
    const vectorStore = new ConvexVectorStore(new FakeEmbeddings({}), { ctx });

    const result = await vectorStore.similaritySearch(query, 3);
    return result.map(({ metadata }) => metadata);
  },
});
