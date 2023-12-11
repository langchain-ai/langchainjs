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
  // Optional `k` parameter to search for more child documents in VectorStore.
  // Note that this does not exactly correspond to the number of final (parent) documents
  // retrieved, as multiple child documents can point to the same parent.
  childK: 20,
  // Optional `k` parameter to limit number of final, parent documents returned from this
  // retriever and sent to LLM. This is an upper-bound, and the final count may be lower than this.
  parentK: 5,
});
const textLoader = new TextLoader("../examples/state_of_the_union.txt");
const parentDocuments = await textLoader.load();

// We must add the parent documents via the retriever's addDocuments method
await retriever.addDocuments(parentDocuments);

const retrievedDocs = await retriever.getRelevantDocuments("justice breyer");

// Retrieved chunks are the larger parent chunks
console.log(retrievedDocs);
/*
  [
    Document {
      pageContent: 'Tonight, I call on the Senate to pass — pass the Freedom to Vote Act. Pass the John Lewis Act — Voting Rights Act. And while you’re at it, pass the DISCLOSE Act so Americans know who is funding our elections.\n' +
        '\n' +
        'Look, tonight, I’d — I’d like to honor someone who has dedicated his life to serve this country: Justice Breyer — an Army veteran, Constitutional scholar, retiring Justice of the United States Supreme Court.',
      metadata: { source: '../examples/state_of_the_union.txt', loc: [Object] }
    },
    Document {
      pageContent: 'As I did four days ago, I’ve nominated a Circuit Court of Appeals — Ketanji Brown Jackson. One of our nation’s top legal minds who will continue in just Brey- — Justice Breyer’s legacy of excellence. A former top litigator in private practice, a former federal public defender from a family of public-school educators and police officers — she’s a consensus builder.',
      metadata: { source: '../examples/state_of_the_union.txt', loc: [Object] }
    },
    Document {
      pageContent: 'Justice Breyer, thank you for your service. Thank you, thank you, thank you. I mean it. Get up. Stand — let me see you. Thank you.\n' +
        '\n' +
        'And we all know — no matter what your ideology, we all know one of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court.',
      metadata: { source: '../examples/state_of_the_union.txt', loc: [Object] }
    }
  ]
*/
