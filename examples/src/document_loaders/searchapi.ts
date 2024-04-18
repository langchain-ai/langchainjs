import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TokenTextSplitter } from "langchain/text_splitter";
import { SearchApiLoader } from "langchain/document_loaders/web/searchapi";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

// Initialize the necessary components
const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
});
const embeddings = new OpenAIEmbeddings();
const apiKey = "Your SearchApi API key";

// Define your question and query
const question = "Your question here";
const query = "Your query here";

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
