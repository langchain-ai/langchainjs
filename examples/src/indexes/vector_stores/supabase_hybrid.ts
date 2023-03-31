import { SupabaseVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";

export const run = async () => {
  const client = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  const vectorStore = await SupabaseVectorStore.fromTexts(
    ["hello bye", "hello world bye", "what's this?"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings(),
    {
      client,
      tableName: "documents",
      queryName: "match_documents",
    }
  );

  const result = await vectorStore.hybridSearch("hello bye", 2, 2);

  console.log(result);
};
