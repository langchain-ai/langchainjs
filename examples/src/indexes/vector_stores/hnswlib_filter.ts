import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "@langchain/openai";

const vectorStore = await HNSWLib.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings()
);

const result = await vectorStore.similaritySearch(
  "hello world",
  10,
  (document) => document.metadata.id === 3
);

// only "hello nice world" will be returned
console.log(result);
