import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { SerpAPILoader } from "@langchain/community/document_loaders/web/serpapi";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

// Initialize the necessary components
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
});
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

const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  ["human", "{input}"],
]);

const combineDocsChain = await createStuffDocumentsChain({
  llm,
  prompt: questionAnsweringPrompt,
});

const chain = await createRetrievalChain({
  retriever: vectorStore.asRetriever(),
  combineDocsChain,
});

const res = await chain.invoke({
  input: question,
});

console.log(res.answer);
