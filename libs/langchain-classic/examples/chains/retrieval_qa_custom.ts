import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as fs from "fs";
import { loadQAMapReduceChain } from "langchain/chains";

// Initialize the LLM to use to answer the question.
const model = new OpenAI({});
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

const query = "What did the president say about Justice Breyer?";

// Create a vector store retriever from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
const retriever = vectorStore.asRetriever();

const relevantDocs = await retriever.invoke(query);

const mapReduceChain = loadQAMapReduceChain(model);

const result = await mapReduceChain.invoke({
  question: query,
  input_documents: relevantDocs,
});

console.log({ result });
/*
{
  result: " The President thanked Justice Breyer for his service and acknowledged him as one of the nation's top legal minds whose legacy of excellence will be continued."
}
*/
