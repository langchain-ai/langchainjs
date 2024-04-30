import * as fs from "fs";

import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { LLMChainExtractor } from "langchain/retrievers/document_compressors/chain_extract";

const model = new OpenAI({
  model: "gpt-3.5-turbo-instruct",
});
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

const retrievedDocs = await retriever.invoke(
  "What did the speaker say about Justice Breyer?"
);

console.log({ retrievedDocs });

/*
  {
    retrievedDocs: [
      Document {
        pageContent: 'One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence.',
        metadata: [Object]
      },
      Document {
        pageContent: '"Tonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service."',
        metadata: [Object]
      },
      Document {
        pageContent: 'The onslaught of state laws targeting transgender Americans and their families is wrong.',
        metadata: [Object]
      }
    ]
  }
*/
