import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

// Initialize the LLM to use to answer the question.
const model = new OpenAI({});
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

// Initialize a retriever wrapper around the vector store
const vectorStoreRetriever = vectorStore.asRetriever();

// Create a chain that uses the OpenAI LLM and HNSWLib vector store.
const chain = RetrievalQAChain.fromLLM(model, vectorStoreRetriever);
const res = await chain.invoke({
  query: "What did the president say about Justice Breyer?",
});
console.log({ res });
/*
{
  res: {
    text: 'The president said that Justice Breyer was an Army veteran, Constitutional scholar,
    and retiring Justice of the United States Supreme Court and thanked him for his service.'
  }
}
*/
