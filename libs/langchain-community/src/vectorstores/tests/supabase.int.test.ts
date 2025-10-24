/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";

import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { SupabaseVectorStore, SupabaseFilterRPCCall } from "../supabase.js";

test("SupabaseVectorStore with external ids", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, { client });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    { pageContent: createdAt.toString(), metadata: { a: createdAt } },
    { pageContent: "hi", metadata: { a: createdAt } },
    { pageContent: "bye", metadata: { a: createdAt } },
    { pageContent: "what's this", metadata: { a: createdAt } },
  ]);

  const results = await store.similaritySearch(createdAt.toString(), 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { a: createdAt },
      pageContent: createdAt.toString(),
    }),
  ]);
});

test("Search a SupabaseVectorStore using a metadata filter", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
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

test("Search a SupabaseVectorStore with a functional metadata filter", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const docs = [
    {
      pageContent:
        "This is a long text, but it actually means something because vector database does not understand Lorem Ipsum. So I would need to expand upon the notion of quantum fluff, a theorectical concept where subatomic particles coalesce to form transient multidimensional spaces. Yet, this abstraction holds no real-world application or comprehensible meaning, reflecting a cosmic puzzle.",
      metadata: { b: 1, c: 10, stuff: "right", created_at: createdAt },
    },
    {
      pageContent:
        "This is a long text, but it actually means something because vector database does not understand Lorem Ipsum. So I would need to proceed by discussing the echo of virtual tweets in the binary corridors of the digital universe. Each tweet, like a pixelated canary, hums in an unseen frequency, a fascinatingly perplexing phenomenon that, while conjuring vivid imagery, lacks any concrete implication or real-world relevance, portraying a paradox of multidimensional spaces in the age of cyber folklore.",
      metadata: { b: 2, c: 9, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "hello",
      metadata: { b: 1, c: 9, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "hello",
      metadata: { b: 1, c: 9, stuff: "wrong", created_at: createdAt },
    },
    {
      pageContent: "hi",
      metadata: { b: 2, c: 8, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "bye",
      metadata: { b: 3, c: 7, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "what's this",
      metadata: { b: 4, c: 6, stuff: "right", created_at: createdAt },
    },
  ];

  await store.addDocuments(docs);

  const funcFilterA: SupabaseFilterRPCCall = (rpc) =>
    rpc
      .filter("metadata->b::int", "lt", 3)
      .filter("metadata->c::int", "gt", 7)
      .filter("metadata->created_at::int", "eq", createdAt)
      .textSearch("content", `'multidimensional' & 'spaces'`, {
        config: "english",
      });

  const resultA = await store.similaritySearch("quantum", 4, funcFilterA);

  const gibberish = resultA.map((doc) => doc.pageContent);
  expect(gibberish).toEqual([docs[0].pageContent, docs[1].pageContent]);

  const funcFilterB: SupabaseFilterRPCCall = (rpc) =>
    rpc
      .filter("metadata->b::int", "lt", 3)
      .filter("metadata->c::int", "gt", 7)
      .filter("metadata->>stuff", "eq", "right")
      .filter("metadata->created_at::int", "eq", createdAt);

  const resultB = await store.similaritySearch("hello", 2, funcFilterB);

  expect(resultB).toEqual([
    new Document({
      pageContent: "hello",
      metadata: {
        b: 1,
        c: 9,
        stuff: "right",
        created_at: createdAt,
      },
    }),
    new Document({
      pageContent: "hi",
      metadata: {
        b: 2,
        c: 8,
        stuff: "right",
        created_at: createdAt,
      },
    }),
  ]);
});

test("Search a SupabaseVectorStore with MMR", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, { client });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    { pageContent: "hi", metadata: { a: createdAt } },
    { pageContent: "greetings", metadata: { a: createdAt } },
    { pageContent: "bye", metadata: { a: createdAt } },
    { pageContent: "what's this", metadata: { a: createdAt } },
  ]);

  const results = await store.maxMarginalRelevanceSearch("hello world", {
    k: 2,
    fetchK: 20,
    filter: { a: createdAt },
  });

  expect(results).toHaveLength(2);

  expect(results).toEqual([
    new Document({
      metadata: { a: createdAt },
      pageContent: "greetings",
    }),
    new Document({
      metadata: { a: createdAt },
      pageContent: "what's this",
    }),
  ]);
});

test("Search a SupabaseVectorStore with MMR and a functional metadata filter", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const docs = [
    {
      pageContent:
        "This is a long text, but it actually means something because vector database does not understand Lorem Ipsum. So I would need to expand upon the notion of quantum fluff, a theorectical concept where subatomic particles coalesce to form transient multidimensional spaces. Yet, this abstraction holds no real-world application or comprehensible meaning, reflecting a cosmic puzzle.",
      metadata: { b: 1, c: 10, stuff: "right", created_at: createdAt },
    },
    {
      pageContent:
        "This is a long text, but it actually means something because vector database does not understand Lorem Ipsum. So I would need to proceed by discussing the echo of virtual tweets in the binary corridors of the digital universe. Each tweet, like a pixelated canary, hums in an unseen frequency, a fascinatingly perplexing phenomenon that, while conjuring vivid imagery, lacks any concrete implication or real-world relevance, portraying a paradox of multidimensional spaces in the age of cyber folklore.",
      metadata: { b: 2, c: 9, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "hello",
      metadata: { b: 1, c: 9, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "hello",
      metadata: { b: 1, c: 9, stuff: "wrong", created_at: createdAt },
    },
    {
      pageContent: "hi",
      metadata: { b: 2, c: 8, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "bye",
      metadata: { b: 3, c: 7, stuff: "right", created_at: createdAt },
    },
    {
      pageContent: "what's this",
      metadata: { b: 4, c: 6, stuff: "right", created_at: createdAt },
    },
  ];

  await store.addDocuments(docs);

  const funcFilter: SupabaseFilterRPCCall = (rpc) =>
    rpc
      .filter("metadata->b::int", "lt", 3)
      .filter("metadata->c::int", "gt", 7)
      .filter("metadata->created_at::int", "eq", createdAt)
      .textSearch("content", `'multidimensional' & 'spaces'`, {
        config: "english",
      });

  const result = await store.maxMarginalRelevanceSearch("quantum", {
    k: 4,
    filter: funcFilter,
  });

  const gibberish = result.map((doc) => doc.pageContent);
  expect(gibberish).toEqual([docs[0].pageContent, docs[1].pageContent]);
});

test("Upsert on a SupabaseVectorStore", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const ids = await store.addDocuments([
    { pageContent: "hello 0", metadata: { created_at: createdAt } },
  ]);

  const results = await store.similaritySearch("hello", 2, {
    created_at: createdAt,
  });
  expect(results).toHaveLength(1);
  const ids2 = await store.addDocuments(
    [{ pageContent: "hello 1", metadata: { created_at: createdAt } }],
    { ids }
  );
  expect(ids).toEqual(ids2);
  const results2 = await store.similaritySearch("hello", 2, {
    created_at: createdAt,
  });
  expect(results2).toHaveLength(1);
  expect(results2[0].pageContent).toEqual("hello 1");
});

test("Delete on a SupabaseVectorStore", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const ids = await store.addDocuments([
    { pageContent: "hello 0", metadata: { created_at: createdAt } },
    { pageContent: "hello 1", metadata: { created_at: createdAt + 1 } },
    { pageContent: "hello 2", metadata: { created_at: createdAt + 2 } },
    { pageContent: "hello 3", metadata: { created_at: createdAt + 2 } },
  ]);

  const results = await store.similaritySearch("hello", 2, {
    created_at: createdAt + 2,
  });

  expect(results).toHaveLength(2);

  expect(results).toEqual([
    new Document({
      metadata: { created_at: createdAt + 2 },
      pageContent: "hello 2",
    }),
    new Document({
      metadata: { created_at: createdAt + 2 },
      pageContent: "hello 3",
    }),
  ]);

  await store.delete({ ids: ids.slice(-1) });

  const results2 = await store.similaritySearch("hello", 1, {
    created_at: createdAt + 2,
  });

  expect(results2).toEqual([
    new Document({
      metadata: { created_at: createdAt + 2 },
      pageContent: "hello 2",
    }),
  ]);
});

test("Add documents with manual ids", async () => {
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL!,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY!
  );

  const embeddings = new OpenAIEmbeddings();

  const store = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
    upsertBatchSize: 2,
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const ids = [
    (createdAt + 1).toString(),
    (createdAt + 2).toString(),
    (createdAt + 3).toString(),
    (createdAt + 4).toString(),
  ];

  const returnedIds = await store.addDocuments(
    [
      { pageContent: "hello 0", metadata: { created_at: createdAt } },
      { pageContent: "hello 1", metadata: { created_at: createdAt + 1 } },
      { pageContent: "hello 2", metadata: { created_at: createdAt + 2 } },
      { pageContent: "hello 3", metadata: { created_at: createdAt + 2 } },
    ],
    { ids }
  );
  expect(ids).toEqual(returnedIds.map((id) => id.toString()));
  await store.delete({ ids });
});
