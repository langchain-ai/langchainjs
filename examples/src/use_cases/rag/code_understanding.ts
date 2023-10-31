import { Pinecone } from "@pinecone-database/pinecone";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ConversationSummaryMemory } from "langchain/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "langchain/vectorstores/chroma";
import { PineconeStore } from "langchain/vectorstores/pinecone";

// Define the path to the repo to preform RAG on.
const REPO_PATH = "/tmp/test_repo";

// Load the file
const loader = new DirectoryLoader(REPO_PATH, {
  ".ts": (path) => new TextLoader(path),
});
const docs = await loader.load();

// Split the documents
const typescriptSplitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
  chunkSize: 2000,
  chunkOverlap: 200,
});

const texts = await typescriptSplitter.splitDocuments(docs);

console.log(texts.length);
// 3324

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index("test");

await PineconeStore.fromDocuments(docs, new OpenAIEmbeddings(), {
  pineconeIndex,
  maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
});

const chromaConfig = {
  collectionName: "rag-code-understanding",
  url: "http://localhost:8000", // Optional, will default to this value
  collectionMetadata: {
    "hnsw:space": "cosine",
  }, // Optional, can be used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
};
const chromaDb = await Chroma.fromDocuments(
  texts,
  new OpenAIEmbeddings(),
  chromaConfig
);
console.log("loaded texts to store");
const retriever = chromaDb.asRetriever({
  searchType: "mmr",
  searchKwargs: { fetchK: 8 },
});

const llm = new ChatOpenAI({ modelName: "gpt-4" });
const memory = new ConversationSummaryMemory({
  llm,
  returnMessages: true,
  memoryKey: "chat_history",
});

const qa = ConversationalRetrievalQAChain.fromLLM(llm, retriever, {
  memory,
});

const question = "How can I initialize a ReAct agent?";
const result = await qa.invoke({ question });
console.log(result);
