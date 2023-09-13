import { expect, test } from "@jest/globals";
import { CohereEmbeddings } from "../../embeddings/cohere.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { MultiQueryRetriever } from "../multi_query.js";
import { ChatAnthropic } from "../../chat_models/anthropic.js";

test("Should work with a question input", async () => {
  const vectorstore = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new CohereEmbeddings()
  );
  const model = new ChatAnthropic({});
  const retriever = MultiQueryRetriever.fromLLM({
    llm: model,
    retriever: vectorstore.asRetriever(),
    verbose: true,
  });

  const query = "What are mitochondria made of?";
  const retrievedDocs = await retriever.getRelevantDocuments(query);
  expect(retrievedDocs[0].pageContent).toContain("mitochondria");
});

test("Should work with a keyword", async () => {
  const vectorstore = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
      "mitochondria is the powerhouse of the cell",
      "mitochondria is made of lipids",
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new CohereEmbeddings()
  );
  const model = new ChatAnthropic({});
  const retriever = MultiQueryRetriever.fromLLM({
    llm: model,
    retriever: vectorstore.asRetriever(),
    verbose: true,
  });

  const query = "cars";
  const retrievedDocs = await retriever.getRelevantDocuments(query);
  expect(retrievedDocs[0].pageContent).toContain("Cars");
});
