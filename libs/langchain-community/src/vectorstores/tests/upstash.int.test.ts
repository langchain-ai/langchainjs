import { Index } from "@upstash/vector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { UpstashVectorStore } from "../upstash.js";
import { sleep } from "../../utils/time.js";

describe("UpstashVectorStore", () => {
  let store: UpstashVectorStore;
  let embeddings: OpenAIEmbeddings;
  let index: Index;

  beforeEach(async () => {
    index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL as string,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
    });

    embeddings = new OpenAIEmbeddings();

    store = new UpstashVectorStore(embeddings, {
      index,
    });

    expect(store).toBeDefined();
  });

  test.skip("basic operations with documents", async () => {
    const createdAt = new Date().getTime();

    const ids = await store.addDocuments([
      { pageContent: "hello", metadata: { a: createdAt + 1 } },
      { pageContent: "car", metadata: { a: createdAt } },
      { pageContent: "adjective", metadata: { a: createdAt } },
      { pageContent: "hi", metadata: { a: createdAt } },
    ]);

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const results1 = await store.similaritySearchWithScore("hello!", 1);
    expect(results1).toHaveLength(1);

    expect(results1).toEqual([
      new Document({ metadata: { a: createdAt + 1 }, pageContent: "hello" }),
    ]);

    const results2 = await store.similaritySearchWithScore("testing!", 6);

    expect(results2).toHaveLength(4);

    await store.delete({ ids: ids.slice(2) });

    const results3 = await store.similaritySearchWithScore("testing again!", 6);

    expect(results3).toHaveLength(2);
  });

  test.skip("UpstashVectorStore.fromText", async () => {
    const vectorStore = await UpstashVectorStore.fromTexts(
      ["hello there!", "what are you building?", "vectors are great!"],
      [
        { id: 1, name: "text1" },
        { id: 2, name: "text2" },
        { id: 3, name: "text3" },
      ],
      embeddings,
      { index }
    );

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const results1 = await vectorStore.similaritySearch("vectors are great", 1);

    expect(results1).toEqual([
      new Document({
        pageContent: "vectors are great!",
        metadata: { id: 3, name: "text3" },
      }),
    ]);
  });
});
