import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const store = await MemoryVectorStore.fromDocuments(
  [
    new Document({
      pageContent: "This is a test document",
      metadata: {
        id: "1",
      },
    }),
    new Document({
      pageContent: "This is a test documen2222t",
      metadata: {
        id: "2",
      },
    }),
  ],
  new OpenAIEmbeddings()
);

console.log(await retriever.invoke("This is a test document"));
