import { ZepVectorStore } from "langchain/vectorstores/zep";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";

const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();
export const run = async () => {
  const zepConfig = {
    apiUrl: "http://server1:8000", // this should be the URL of your Zep implementation
    collectionName: "exampleCollection",
    embeddingDimensions: 1536, // this much match the width of the embeddings you're using
    isAutoEmbedded: false,
  };

  const embeddings = new OpenAIEmbeddings();

  const vectorStore = await ZepVectorStore.fromDocuments(
    docs,
    embeddings,
    zepConfig
  );

  const results = await vectorStore.similaritySearchWithScore("bar", 3);

  console.log(JSON.stringify(results));
};
