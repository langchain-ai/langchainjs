import { expect, test } from "@jest/globals";
import { TextLoader } from "../../document_loaders/fs/text.js";
import { InMemoryDocstore } from "../../stores/doc/in_memory.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { ParentDocumentRetriever } from "../parent_document.js";
import { RecursiveCharacterTextSplitter } from "../../text_splitter.js";

test("Should return the full document if an unsplit parent document has been added", async () => {
  const vectorstore = new MemoryVectorStore(new OpenAIEmbeddings());
  const retriever = new ParentDocumentRetriever({
    vectorstore,
    docstore: new InMemoryDocstore(),
    childSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 0,
      chunkSize: 100,
    }),
  });
  const docs = await new TextLoader(
    "../examples/state_of_the_union.txt"
  ).load();
  await retriever.addDocuments(docs);

  const query = "justice breyer";
  const retrievedDocs = await retriever.getRelevantDocuments(query);
  expect(retrievedDocs.length).toEqual(1);
  expect(retrievedDocs[0].pageContent.length).toBeGreaterThan(1000);
});

test("Should return a part of a document if a parent splitter is passed", async () => {
  const vectorstore = new MemoryVectorStore(new OpenAIEmbeddings());
  const docstore = new InMemoryDocstore();
  const retriever = new ParentDocumentRetriever({
    vectorstore,
    docstore,
    parentSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 0,
      chunkSize: 500,
    }),
    childSplitter: new RecursiveCharacterTextSplitter({
      chunkOverlap: 0,
      chunkSize: 50,
    }),
  });
  const docs = await new TextLoader(
    "../examples/state_of_the_union.txt"
  ).load();
  await retriever.addDocuments(docs);
  console.log(docstore._docs.size);
  const query = "justice breyer";
  const retrievedDocs = await retriever.getRelevantDocuments(query);
  const vectorstoreRetreivedDocs = await vectorstore.similaritySearch(
    "justice breyer"
  );
  console.log(vectorstoreRetreivedDocs, vectorstoreRetreivedDocs.length);
  console.log(retrievedDocs);
  expect(retrievedDocs.length).toBeGreaterThan(1);
  expect(retrievedDocs[0].pageContent.length).toBeGreaterThan(100);
});
