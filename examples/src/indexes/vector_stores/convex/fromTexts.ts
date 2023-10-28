"use node";

import { ConvexVectorStore } from "langchain/vectorstores/convex";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { action } from "./_generated/server.js";

export const ingest = action({
  args: {},
  handler: async (ctx) => {
    await ConvexVectorStore.fromTexts(
      ["Hello world", "Bye bye", "What's this?"],
      [{ prop: 2 }, { prop: 1 }, { prop: 3 }],
      new OpenAIEmbeddings(),
      { ctx }
    );
  },
});
