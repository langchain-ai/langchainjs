import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { InMemoryStore } from "langchain/storage/in_memory";
import { ParentDocumentRetriever } from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";

const vectorstore = new MemoryVectorStore(new OpenAIEmbeddings());
const docstore = new InMemoryStore();
const retriever = new ParentDocumentRetriever({
  vectorstore,
  docstore,
  // Optional, not required if you're already passing in split documents
  parentSplitter: new RecursiveCharacterTextSplitter({
    chunkOverlap: 0,
    chunkSize: 500,
  }),
  childSplitter: new RecursiveCharacterTextSplitter({
    chunkOverlap: 0,
    chunkSize: 50,
  }),
  // Setting score threshold option will make the retriever use
  // the ScoreThresholdRetriever instead of a plain vector store lookup.
  scoreThresholdOptions: {
    minSimilarityScore: 0.1, // Setting a low score threshold will return many documents.
    maxK: 1, // Set maxK to 1 so only one document is returned in the end.
  },
});
const textLoader = new TextLoader("../examples/state_of_the_union.txt");
const parentDocuments = await textLoader.load();

// We must add the parent documents via the retriever's addDocuments method
await retriever.addDocuments(parentDocuments);

const retrievedDocs = await retriever.getRelevantDocuments("justice breyer");

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
