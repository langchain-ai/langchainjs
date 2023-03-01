import { PGVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";

export const run = async () => {
  const client = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  const vectorStore = await PGVectorStore.fromExistingIndex(
    client,
    new OpenAIEmbeddings(),
    "search_embeddings"
  );

  const resultOne = await vectorStore.similaritySearchWithScore(
    "How do I get a record deal",
    0.75
  );
  console.log(resultOne);
};
