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
      datasetId: "my-dataset",
    }
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);

  console.log("Embedbase result one:", resultOne);

  // now head to https://app.embedbase.xyz/dashboard/explorer/my-dataset?page=0
  // to see the results

  // or https://app.embedbase.xyz/dashboard/playground to talk to your dataset
  // (tick the my-dataset box)
};
