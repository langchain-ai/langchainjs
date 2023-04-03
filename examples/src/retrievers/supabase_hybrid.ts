import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";
import { SupabaseHybridKeyWordSearch } from "langchain/retrievers";

export const run = async () => {
  const client = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  const embeddings = new OpenAIEmbeddings();

  const retriever = new SupabaseHybridKeyWordSearch(embeddings, {
    client,
    sim_k: 2,
    kw_k: 2,
  });

  const results = await retriever.getRelevantDocuments("hello bye");

  console.log(results);
};
