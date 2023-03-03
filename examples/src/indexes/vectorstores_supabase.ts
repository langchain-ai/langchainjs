import { PGVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";

export const run = async () => {
  const client = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  const vectorStore = await PGVectorStore.fromTexts(
    client,
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    "documents",
    "match_documents",
  );

  const resultOne = await vectorStore.similaritySearchWithScore(
    "Hello world",
    .80
  );
  console.dir(resultOne, { depth: null });
};
