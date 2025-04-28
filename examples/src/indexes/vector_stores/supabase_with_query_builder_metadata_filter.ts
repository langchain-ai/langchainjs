import {
  SupabaseFilterRPCCall,
  SupabaseVectorStore,
} from "@langchain/community/vectorstores/supabase";
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
    {
      pageContent:
        "This is a long text, but it actually means something because vector database does not understand Lorem Ipsum. So I would need to expand upon the notion of quantum fluff, a theorectical concept where subatomic particles coalesce to form transient multidimensional spaces. Yet, this abstraction holds no real-world application or comprehensible meaning, reflecting a cosmic puzzle.",
      metadata: { b: 1, c: 10, stuff: "right" },
    },
    {
      pageContent:
        "This is a long text, but it actually means something because vector database does not understand Lorem Ipsum. So I would need to proceed by discussing the echo of virtual tweets in the binary corridors of the digital universe. Each tweet, like a pixelated canary, hums in an unseen frequency, a fascinatingly perplexing phenomenon that, while conjuring vivid imagery, lacks any concrete implication or real-world relevance, portraying a paradox of multidimensional spaces in the age of cyber folklore.",
      metadata: { b: 2, c: 9, stuff: "right" },
    },
    { pageContent: "hello", metadata: { b: 1, c: 9, stuff: "right" } },
    { pageContent: "hello", metadata: { b: 1, c: 9, stuff: "wrong" } },
    { pageContent: "hi", metadata: { b: 2, c: 8, stuff: "right" } },
    { pageContent: "bye", metadata: { b: 3, c: 7, stuff: "right" } },
    { pageContent: "what's this", metadata: { b: 4, c: 6, stuff: "right" } },
  ];

  // Also supports an additional {ids: []} parameter for upsertion
  await store.addDocuments(docs);

  const funcFilterA: SupabaseFilterRPCCall = (rpc) =>
    rpc
      .filter("metadata->b::int", "lt", 3)
      .filter("metadata->c::int", "gt", 7)
      .textSearch("content", `'multidimensional' & 'spaces'`, {
        config: "english",
      });

  const resultA = await store.similaritySearch("quantum", 4, funcFilterA);

  const funcFilterB: SupabaseFilterRPCCall = (rpc) =>
    rpc
      .filter("metadata->b::int", "lt", 3)
      .filter("metadata->c::int", "gt", 7)
      .filter("metadata->>stuff", "eq", "right");

  const resultB = await store.similaritySearch("hello", 2, funcFilterB);

  console.log(resultA, resultB);
};
