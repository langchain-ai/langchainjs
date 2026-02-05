// If you want to import the browser version, use the following line instead:
// import { CloseVectorWeb } from "@langchain/community/vectorstores/closevector/web";
import { CloseVectorNode } from "@langchain/community/vectorstores/closevector/node";
import { CloseVectorWeb } from "@langchain/community/vectorstores/closevector/web";
import { OpenAIEmbeddings } from "@langchain/openai";

// Create a vector store through any method, here from texts as an example
// If you want to import the browser version, use the following line instead:
// const vectorStore = await CloseVectorWeb.fromTexts(
const vectorStore = await CloseVectorNode.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings(),
  undefined,
  {
    key: "your access key",
    secret: "your secret",
  }
);

// Save the vector store to cloud
await vectorStore.saveToCloud({
  description: "example",
  public: true,
});

const { uuid } = vectorStore.instance;

// Load the vector store from cloud
// const loadedVectorStore = await CloseVectorWeb.load(
const loadedVectorStore = await CloseVectorNode.loadFromCloud({
  uuid,
  embeddings: new OpenAIEmbeddings(),
  credentials: {
    key: "your access key",
    secret: "your secret",
  },
});

// If you want to import the node version, use the following lines instead:
// const loadedVectorStoreOnNode = await CloseVectorNode.loadFromCloud({
//   uuid,
//   embeddings: new OpenAIEmbeddings(),
//   credentials: {
//     key: "your access key",
//     secret: "your secret"
//   }
// });

const loadedVectorStoreOnBrowser = await CloseVectorWeb.loadFromCloud({
  uuid,
  embeddings: new OpenAIEmbeddings(),
  credentials: {
    key: "your access key",
    secret: "your secret",
  },
});

// vectorStore and loadedVectorStore are identical
const result = await loadedVectorStore.similaritySearch("hello world", 1);
console.log(result);

// or
const resultOnBrowser = await loadedVectorStoreOnBrowser.similaritySearch(
  "hello world",
  1
);
console.log(resultOnBrowser);
