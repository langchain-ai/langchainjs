import { expect, test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { MemoryVectorStore } from "../../vectorstores/memory.js"
import { RecencyRankedRetriever } from "../recency_ranked.js";



test("RecencyRankedRetriever", async () => {
  const docs = [
    new Document({
      pageContent: "A",
      metadata: { date: new Date("2023-01-01") },
    }),
    new Document({
      pageContent: "B",
      metadata: { date: new Date("2023-02-01") },
    }),
    new Document({
      pageContent: "C",
      metadata: { date: new Date("2023-03-01") },
    }),
  ];

  const vectorstore = new MemoryVectorStore(new FakeEmbeddings());
  
  await vectorstore.addDocuments(docs);
  
  const retriever = new RecencyRankedRetriever({
    vectorStore: vectorstore,
    k: 3,
    topK: 2,
    recencyWeight: 0.99,
  });
  
  const results = await retriever.invoke("test query");

  expect(results).toHaveLength(2);
  expect(results[0].pageContent).toBe("C");
  expect(results[1].pageContent).toBe("B");
});

test("RecencyRankedRetriever throws error for missing date metadata", async () => {
    const docs = [
      new Document({
        pageContent: "A",
        metadata: {},
      }),
      new Document({
        pageContent: "B",
        metadata: {},
      }),
      new Document({
        pageContent: "C",
        metadata: {},
      }),
    ];
  
    const vectorstore = new MemoryVectorStore(new FakeEmbeddings());
    
    await vectorstore.addDocuments(docs);
    
    const retriever = new RecencyRankedRetriever({
      vectorStore: vectorstore,
      k: 3,
      topK: 2,
      recencyWeight: 0.99,
    });
    
    await expect(retriever.invoke("test query")).rejects.toThrow(
      "All documents must have a 'date' metadata of type Date"
    );
  });
