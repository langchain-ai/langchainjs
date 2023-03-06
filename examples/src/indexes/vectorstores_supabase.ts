import { SupabaseVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";

export const run = async () => {
  const supabaseClient = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  const vectorStore = await SupabaseVectorStore.fromTexts(
    supabaseClient,
    ["Hello world", "Bye bye", "What's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);

  console.log(resultOne);
};
