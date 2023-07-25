import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain } from "langchain/chains";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SerpAPILoader } from "langchain/document_loaders/web/serpapi";

// Initialize the necessary components
const llm = new OpenAI();
const embeddings = new OpenAIEmbeddings();
const apiKey = "Your SerpAPI API key";

// Define your question and query
const question = "Your question here";
const query = "Your query here";

// Use SerpAPILoader to load web search results
const loader = new SerpAPILoader({ q: query, apiKey });
const docs = await loader.load();

// Use MemoryVectorStore to store the loaded documents in memory
const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

// Use RetrievalQAChain to retrieve documents and answer the question
const chain = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever());
const answer = await chain.call({ query: question });

console.log(answer.text);
