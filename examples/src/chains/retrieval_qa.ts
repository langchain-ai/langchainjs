import { OpenAI } from "langchain/llms/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "langchain/schema/runnable";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";

// Initialize the LLM to use to answer the question.
const model = new OpenAI({});
const text = fs.readFileSync("examples/state_of_the_union.txt", "utf8");
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

const serializedDocs = (docs: Array<Document>) =>
  docs.map((doc) => doc.pageContent).join("\n\n");

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

// Initialize a retriever wrapper around the vector store
const vectorStoreRetriever = vectorStore.asRetriever();

const questionPrompt =
  PromptTemplate.fromTemplate(`Based on the following context: {context}
Answer this question: {question}`);

const chain = RunnableSequence.from([
  {
    context: vectorStoreRetriever.pipe(serializedDocs),
    question: new RunnablePassthrough(),
  },
  questionPrompt,
  model,
  new StringOutputParser(),
]);

const answer = await chain.invoke(
  "What did the president say about Justice Breyer?"
);

console.log({ answer });

/*
{
  answer: '\n' +
    '\n' +
    'The president said: "Tonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service."'
}
*/
