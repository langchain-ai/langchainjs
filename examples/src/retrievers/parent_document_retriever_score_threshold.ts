import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { InMemoryStore } from "langchain/storage/in_memory";
import { ParentDocumentRetriever } from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { ScoreThresholdRetriever } from "langchain/retrievers/score_threshold";

const vectorstore = new MemoryVectorStore(new OpenAIEmbeddings());
const docstore = new InMemoryStore();
const childDocumentRetriever = ScoreThresholdRetriever.fromVectorStore(
  vectorstore,
  {
    minSimilarityScore: 0.01, // Essentially no threshold
    maxK: 1, // Only return the top result
  }
);
const retriever = new ParentDocumentRetriever({
  vectorstore,
  docstore,
  childDocumentRetriever,
  // Optional, not required if you're already passing in split documents
  parentSplitter: new RecursiveCharacterTextSplitter({
    chunkOverlap: 0,
    chunkSize: 500,
  }),
  childSplitter: new RecursiveCharacterTextSplitter({
    chunkOverlap: 0,
    chunkSize: 50,
  }),
});
const textLoader = new TextLoader("../examples/state_of_the_union.txt");
const parentDocuments = await textLoader.load();

// We must add the parent documents via the retriever's addDocuments method
await retriever.addDocuments(parentDocuments);

const retrievedDocs = await retriever.invoke("justice breyer");

// Retrieved chunk is the larger parent chunk
console.log(retrievedDocs);
/*
  [
    Document {
      pageContent: 'Tonight, I call on the Senate to pass — pass the Freedom to Vote Act. Pass the John Lewis Act — Voting Rights Act. And while you’re at it, pass the DISCLOSE Act so Americans know who is funding our elections.\n' +
        '\n' +
        'Look, tonight, I’d — I’d like to honor someone who has dedicated his life to serve this country: Justice Breyer — an Army veteran, Constitutional scholar, retiring Justice of the United States Supreme Court.',
      metadata: { source: '../examples/state_of_the_union.txt', loc: [Object] }
    },
  ]
*/
