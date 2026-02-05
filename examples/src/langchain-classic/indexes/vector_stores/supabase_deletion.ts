import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/supabase

const privateKey = process.env.SUPABASE_PRIVATE_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

const url = process.env.SUPABASE_URL;
if (!url) throw new Error(`Expected env var SUPABASE_URL`);

export const run = async () => {
  const client = createClient(url, privateKey);

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
  });

  const docs = [
    { pageContent: "hello", metadata: { b: 1, c: 9, stuff: "right" } },
    { pageContent: "hello", metadata: { b: 1, c: 9, stuff: "wrong" } },
  ];

  // Also takes an additional {ids: []} parameter for upsertion
  const ids = await store.addDocuments(docs);

  const resultA = await store.similaritySearch("hello", 2);
  console.log(resultA);

  /*
    [
      Document { pageContent: "hello", metadata: { b: 1, c: 9, stuff: "right" } },
      Document { pageContent: "hello", metadata: { b: 1, c: 9, stuff: "wrong" } },
    ]
  */

  await store.delete({ ids });

  const resultB = await store.similaritySearch("hello", 2);
  console.log(resultB);

  /*
    []
  */
};
