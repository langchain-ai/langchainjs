import { ElasticSearchStore } from "langchain/vectorstores/elasticsearch";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export const run = async () => {
  const vectorStore = await ElasticSearchStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    {
      clientOptions: { node: process.env.ELASTICSEARCH_URL },
      indexName: "test",
    }
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
};
