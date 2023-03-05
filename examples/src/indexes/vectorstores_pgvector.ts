import { PGVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";
import { PGClient } from "../pgvector-supabase.js";

export const run = async () => {
  const supabaseClient = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  const pgClient = new PGClient(supabaseClient);

  const vectorStore = await PGVectorStore.fromTexts(
    pgClient,
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearchWithScore(
    "Hello world",
    0.8
  );
  console.dir(resultOne, { depth: null });
};
