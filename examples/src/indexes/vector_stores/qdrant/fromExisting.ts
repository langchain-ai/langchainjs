import { QdrantVectorStore } from "langchain/vectorstores/qdrant";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await QdrantVectorStore.fromExistingCollection(
  new OpenAIEmbeddings(),
  {
    url: process.env.QDRANT_URL,
    collectionName: "goldel_escher_bach",
  }
);

const response = await vectorStore.similaritySearch("scared", 2);

console.log(response);

/*
[
  Document { pageContent: 'Achilles: Oh, no!', metadata: {} },
  Document {
    pageContent: 'Achilles: Yiikes! What is that?',
    metadata: { id: 1 }
  }
]
*/
