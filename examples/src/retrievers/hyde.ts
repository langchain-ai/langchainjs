import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HydeRetriever } from "langchain/retrievers/hyde";
import { Document } from "langchain/document";

const embeddings = new OpenAIEmbeddings();
const vectorStore = new MemoryVectorStore(embeddings);
const llm = new OpenAI();
const retriever = new HydeRetriever({
  vectorStore,
  llm,
  k: 1,
});

await vectorStore.addDocuments(
  [
    "My name is John.",
    "My name is Bob.",
    "My favourite food is pizza.",
    "My favourite food is pasta.",
  ].map((pageContent) => new Document({ pageContent }))
);

const results = await retriever.getRelevantDocuments(
  "What is my favourite food?"
);

console.log(results);
/*
[
  Document { pageContent: 'My favourite food is pasta.', metadata: {} }
]
*/
