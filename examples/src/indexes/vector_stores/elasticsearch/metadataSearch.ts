import { ElasticSearchStore } from "langchain/vectorstores/elasticsearch";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export const run = async () => {
  const vectorStore = await ElasticSearchStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "Hello world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }],
    new OpenAIEmbeddings(),
    {
      clientOptions: { node: process.env.ELASTICSEARCH_URL },
    }
  );

  // would otherwise return 2 and 4
  const resultOne = await vectorStore.similaritySearch("Hello", 1, { id: 4 });
  console.log(resultOne);
};
