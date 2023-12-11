import { OpenAI } from "langchain/llms/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
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

const relevantDocs = await retriever.getRelevantDocuments(query);

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
