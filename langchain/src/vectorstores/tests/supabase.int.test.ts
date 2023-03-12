/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";

import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { Document } from "../../document.js";
import { SupabaseVectorStore } from "../supabase.js";

test("SupabaseVectorStore with external ids", async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(client, embeddings);

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});
