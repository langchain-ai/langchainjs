import { Chroma } from "langchain/vectorstores/chroma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = await Chroma.fromExistingCollection(
  new OpenAIEmbeddings(),
  { collectionName: "godel-escher-bach" }
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
