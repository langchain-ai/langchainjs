/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { SupabaseHybridKeyWordSearch } from "../SupabaseHybridKeyWordSearch.js";

test("Supabase hybrid keyword search", async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const retriever = new SupabaseHybridKeyWordSearch(embeddings, {
    client,
    sim_k: 2,
    kw_k: 2,
  });

  expect(retriever).toBeDefined();

  const results = await retriever.getRelevantDocuments("hello bye");

  expect(results).toHaveLength(2);
});
