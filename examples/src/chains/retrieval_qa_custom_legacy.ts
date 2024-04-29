import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RetrievalQAChain, loadQAMapReduceChain } from "langchain/chains";
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

// Create a chain that uses a map reduce chain and HNSWLib vector store.
const chain = new RetrievalQAChain({
  combineDocumentsChain: loadQAMapReduceChain(model),
  retriever: vectorStore.asRetriever(),
});
const res = await chain.invoke({
  query: "What did the president say about Justice Breyer?",
});
console.log({ res });
/*
{
  res: {
    text: " The president said that Justice Breyer has dedicated his life to serve his country, and thanked him for his service. He also said that Judge Ketanji Brown Jackson will continue Justice Breyer's legacy of excellence, emphasizing the importance of protecting the rights of citizens, especially women, LGBTQ+ Americans, and access to healthcare. He also expressed his commitment to supporting the younger transgender Americans in America and ensuring they are able to reach their full potential, offering a Unity Agenda for the Nation to beat the opioid epidemic and increase funding for prevention, treatment, harm reduction, and recovery."
  }
}
*/
