"use node";

import { TextLoader } from "langchain/document_loaders/fs/text";
import { CacheBackedEmbeddings } from "langchain/embeddings/cache_backed";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ConvexKVStore } from "@langchain/community/storage/convex";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ConvexVectorStore } from "@langchain/community/vectorstores/convex";
import { action } from "./_generated/server.js";

export const ask = action({
  args: {},
  handler: async (ctx) => {
    const underlyingEmbeddings = new OpenAIEmbeddings();

    const cacheBackedEmbeddings = CacheBackedEmbeddings.fromBytesStore(
      underlyingEmbeddings,
      new ConvexKVStore({ ctx }),
      {
        namespace: underlyingEmbeddings.model,
      }
    );

    const loader = new TextLoader("./state_of_the_union.txt");
    const rawDocuments = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 0,
    });
    const documents = await splitter.splitDocuments(rawDocuments);

    let time = Date.now();
    const vectorstore = await ConvexVectorStore.fromDocuments(
      documents,
      cacheBackedEmbeddings,
      { ctx }
    );
    console.log(`Initial creation time: ${Date.now() - time}ms`);
    /*
      Initial creation time: 1808ms
    */

    // The second time is much faster since the embeddings for the input docs have already been added to the cache
    time = Date.now();
    const vectorstore2 = await ConvexVectorStore.fromDocuments(
      documents,
      cacheBackedEmbeddings,
      { ctx }
    );
    console.log(`Cached creation time: ${Date.now() - time}ms`);
    /*
      Cached creation time: 33ms
    */
  },
});
