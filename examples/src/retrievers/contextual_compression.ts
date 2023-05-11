import * as fs from "fs";

import { OpenAI } from "langchain/llms/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { RetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { LLMChainExtractor } from "langchain/retrievers/document_compressors/chain_extract";

const model = new OpenAI();
const baseCompressor = LLMChainExtractor.fromLLM(model);

const text = fs.readFileSync("state_of_the_union.txt", "utf8");

const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

const retriever = new ContextualCompressionRetriever({
  baseCompressor,
  baseRetriever: vectorStore.asRetriever(),
});

const chain = RetrievalQAChain.fromLLM(model, retriever);

const res = await chain.call({
  query: "What did the speaker say about Justice Breyer?",
});

console.log({ res });
