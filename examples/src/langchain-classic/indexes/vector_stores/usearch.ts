import { USearch } from "@langchain/community/vectorstores/usearch";
import { OpenAIEmbeddings } from "@langchain/openai";

const vectorStore = await USearch.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings()
);

const resultOne = await vectorStore.similaritySearch("hello world", 1);
console.log(resultOne);
