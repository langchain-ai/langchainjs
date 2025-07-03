import * as fs from "node:fs";

import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { Document } from "@langchain/core/documents";

const formatDocumentsAsString = (documents: Document[]) => {
  return documents.map((document) => document.pageContent).join("\n\n");
};

// Initialize the LLM to use to answer the question.
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
// Create a vector store from the documents.
const vectorStore = await MemoryVectorStore.fromDocuments(
  docs,
  new OpenAIEmbeddings()
);

// Initialize a retriever wrapper around the vector store
const vectorStoreRetriever = vectorStore.asRetriever();

// Create a system & human prompt for the chat model
const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_TEMPLATE],
  ["human", "{question}"],
]);

const chain = RunnableSequence.from([
  {
    context: vectorStoreRetriever.pipe(formatDocumentsAsString),
    question: new RunnablePassthrough(),
  },
  prompt,
  model,
  new StringOutputParser(),
]);

const answer = await chain.invoke(
  "What did the president say about Justice Breyer?"
);

console.log({ answer });

/*
  {
    answer: 'The president honored Justice Stephen Breyer by recognizing his dedication to serving the country as an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. He thanked Justice Breyer for his service.'
  }
*/
