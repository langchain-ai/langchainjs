/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";

import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";
import { SupabaseVectorStore } from "../supabase.js";

test.skip("SupabaseVectorStore with external ids", async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, { client });

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

test.skip("Search a SupabaseVectorStore using a metadata filter", async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    { pageContent: "hello 0", metadata: { created_at: createdAt } },
    { pageContent: "hello 1", metadata: { created_at: createdAt + 1 } },
    { pageContent: "hello 2", metadata: { created_at: createdAt + 2 } },
    { pageContent: "hello 3", metadata: { created_at: createdAt + 3 } },
  ]);

  const results = await store.similaritySearch("hello", 1, {
    created_at: createdAt + 2,
  });

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { created_at: createdAt + 2 },
      pageContent: "hello 2",
    }),
  ]);
});
