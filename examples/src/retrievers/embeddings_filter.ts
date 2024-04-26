import * as fs from "fs";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { EmbeddingsFilter } from "langchain/retrievers/document_compressors/embeddings_filter";

const baseCompressor = new EmbeddingsFilter({
  embeddings: new OpenAIEmbeddings(),
  similarityThreshold: 0.8,
});

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
        pageContent: 'And I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence. \n' +
          '\n' +
          'A former top litigator in private practice. A former federal public defender. And from a family of public school educators and police officers. A consensus builder. Since she’s been nominated, she’s received a broad range of support—from the Fraternal Order of Police to former judges appointed by Democrats and Republicans. \n' +
          '\n' +
          'And if we are to advance liberty and justice, we need to secure the Border and fix the immigration system. \n' +
          '\n' +
          'We can do both. At our border, we’ve installed new technology like cutting-edge scanners to better detect drug smuggling.  \n' +
          '\n' +
          'We’ve set up joint patrols with Mexico and Guatemala to catch more human traffickers.  \n' +
          '\n' +
          'We’re putting in place dedicated immigration judges so families fleeing persecution and violence can have their cases heard faster.',
        metadata: [Object]
      },
      Document {
        pageContent: 'In state after state, new laws have been passed, not only to suppress the vote, but to subvert entire elections. \n' +
          '\n' +
          'We cannot let this happen. \n' +
          '\n' +
          'Tonight. I call on the Senate to: Pass the Freedom to Vote Act. Pass the John Lewis Voting Rights Act. And while you’re at it, pass the Disclose Act so Americans can know who is funding our elections. \n' +
          '\n' +
          'Tonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service. \n' +
          '\n' +
          'One of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court. \n' +
          '\n' +
          'And I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence.',
        metadata: [Object]
      }
    ]
  }
*/
