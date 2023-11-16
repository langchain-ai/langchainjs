/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { SupabaseHybridSearch } from "../supabase.js";

test("Supabase hybrid keyword search", async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const retriever = new SupabaseHybridSearch(embeddings, {
    client,
    similarityK: 2,
    keywordK: 2,
  });

  expect(retriever).toBeDefined();

  const results = await retriever.getRelevantDocuments("hello bye");

  expect(results.length).toBeGreaterThan(0);
});
