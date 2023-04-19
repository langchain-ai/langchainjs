import { EmbedbaseVectorStore } from "langchain/vectorstores/embedbase";
import { createClient } from "embedbase-js";
import { FakeEmbeddings } from "langchain/embeddings/fake";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/embedbase

const apiKey = process.env.EMBEDBASE_API_KEY;
if (!apiKey) throw new Error(`Expected env var EMBEDBASE_API_KEY`);

const url = process.env.EMBEDBASE_URL;
if (!url) throw new Error(`Expected env var EMBEDBASE_URL`);

export const run = async () => {
  const client = createClient(url, apiKey);

  const vectorStore = await EmbedbaseVectorStore.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [
      { path: "/path/to/hello" },
      { path: "/path/to/bye" },
      { path: "/path/to/what" },
    ],
    // You don't need to deal with embeddings yourself, just pass in a fake one
    new FakeEmbeddings(),
    {
      embedbase: client,
    }
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);

  console.log("Embedbase result one:", resultOne);
};
