import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RetrievalQAChain } from "langchain/chains";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TokenTextSplitter } from "langchain/text_splitter";
import { SearchApiLoader } from "langchain/document_loaders/web/searchapi";

// Initialize the necessary components
const llm = new OpenAI();
const embeddings = new OpenAIEmbeddings();
const apiKey = "Your SearchApi API key";

// Define your question and query
const question = "Your question here";
const query = "Your question here";

// Use SearchApiLoader to load web search results
const loader = new SearchApiLoader({ q: query, apiKey, engine: "google" });
const docs = await loader.load();

const textSplitter = new TokenTextSplitter({
  chunkSize: 800,
  chunkOverlap: 100,
});
const splitDocs = await textSplitter.splitDocuments(docs);

// Use MemoryVectorStore to store the loaded documents in memory
const vectorStore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);
// Use RetrievalQAChain to retrieve documents and answer the question
const chain = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever(), {
  verbose: true,
});
const answer = await chain.call({ query: question });

console.log(answer.text);
