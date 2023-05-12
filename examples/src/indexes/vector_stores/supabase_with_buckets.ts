import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { createClient } from "@supabase/supabase-js";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/supabase

const privateKey = process.env.SUPABASE_PRIVATE_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

const url = process.env.SUPABASE_URL;
if (!url) throw new Error(`Expected env var SUPABASE_URL`);

export const run = async () => {
  const client = createClient(url, privateKey);

  // Bucket ID is useful if you want to separate your documents into different
  // buckets. For example, if you have a multi-tenant application, you might
  // want to separate documents by tenant ID.
  const bucketIdTenant001 = "tenantId-001";

  const vectorStoreTenant001 = await SupabaseVectorStore.fromTexts(
    ["Chat message 1, Tenant001", "Chat message 2, Tenant001", "Chat message 3, Tenant001"],
    [{ timeStamp: 1 }, { timeStamp: 2 }, { timeStamp: 3 }],
    new OpenAIEmbeddings(),
    {
      client,
      tableName: "documents",
      queryName: "match_documents",
      bucketId: bucketIdTenant001,
    }
  );

  const resultTenant001 = await vectorStoreTenant001.similaritySearch("Message 1", 1);

  /*
  [
    Document {
      pageContent: 'Chat message 1, Tenant001',
      metadata: { timeStamp: 1 }
    }
  ]
  */
  console.log(resultTenant001);

  const bucketIdTenant002 = "tenantId-002";

  const vectorStoreTenant002 = await SupabaseVectorStore.fromTexts(
    ["Chat message 1, Tenant002", "Chat message 2, Tenant002", "Chat message 3, Tenant002"],
    [{ timeStamp: 1 }, { timeStamp: 2 }, { timeStamp: 3 }],
    new OpenAIEmbeddings(),
    {
      client,
      tableName: "documents",
      queryName: "match_documents",
      bucketId: bucketIdTenant002,
    }
  );

  const resultTenant0012 = await vectorStoreTenant002.similaritySearch("Message 1", 1);

  /*
  [
    Document {
      pageContent: 'Chat message 1, Tenant002',
      metadata: { timeStamp: 1 }
    }
  ]
  */
  console.log(resultTenant0012);
};
