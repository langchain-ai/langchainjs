import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import { PromptTemplate } from "@langchain/core/prompts";

const promptTemplate = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}
Answer in Italian:`;
const prompt = PromptTemplate.fromTemplate(promptTemplate);

// Initialize the LLM to use to answer the question.
const model = new OpenAI({});
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

// Create a chain that uses a stuff chain and HNSWLib vector store.
const chain = new RetrievalQAChain({
  combineDocumentsChain: loadQAStuffChain(model, { prompt }),
  retriever: vectorStore.asRetriever(),
});
const res = await chain.invoke({
  query: "What did the president say about Justice Breyer?",
});
console.log({ res });
/*
{
  res: {
    text: ' Il presidente ha elogiato Justice Breyer per il suo servizio e lo ha ringraziato.'
  }
}
*/
