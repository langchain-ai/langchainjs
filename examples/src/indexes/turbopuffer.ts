import { OpenAIEmbeddings } from "@langchain/openai";
import { TurbopufferVectorStore } from "@langchain/community/vectorstores/turbopuffer";

const embeddings = new OpenAIEmbeddings();

const store = new TurbopufferVectorStore(embeddings, {
  apiKey: process.env.TURBOPUFFER_API_KEY,
  namespace: "my-namespace",
});

const createdAt = new Date().getTime();
// Add some documents to your store
const ids = await store.addDocuments([
  { pageContent: createdAt.toString(), metadata: { a: createdAt } },
  { pageContent: "hi", metadata: { a: createdAt } },
  { pageContent: "bye", metadata: { a: createdAt } },
  { pageContent: "what's this", metadata: { a: createdAt } },
]);
// Retrieve documents from the store
const results = await store.similaritySearch(createdAt.toString(), 1);
