import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ElasticSearchStore } from "langchain/vectorstores/elasticsearch";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import * as fs from "fs";

export const run = async () => {
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);
  const vectorStore = await ElasticSearchStore.fromDocuments(
    docs,
    new OpenAIEmbeddings(),
    {
      clientOptions: { node: process.env.ELASTICSEARCH_URL },
      indexName: "test",
    }
  );

  const resultOne = await vectorStore.similaritySearch(
    "What did the president say about Ketanji Brown Jackson",
    1
  );
  console.log(resultOne[0].pageContent);
};
