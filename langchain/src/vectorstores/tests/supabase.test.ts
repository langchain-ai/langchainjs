/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect, jest } from "@jest/globals";
import { SupabaseVectorStore } from "../supabase.js";
import { SupabaseClient } from "@supabase/supabase-js";

import { OpenAIEmbeddings } from "../../embeddings/openai.js";

test('similaritySearchVectorWithScore should call RPC with the vectorstore filters', async () => {
  const supabaseClientMock = {
    rpc: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
  } as Partial<SupabaseClient>;

  const embeddings = new OpenAIEmbeddings();
  const vectorStore = new SupabaseVectorStore(
    embeddings,
    {
      // @ts-ignore
      client: supabaseClientMock,
      tableName: 'documents',
      queryName: 'match_documents',
      filter: { a: 2 }
    },
  );
  await vectorStore.similaritySearchVectorWithScore(
    [1, 2, 3],
    5
  );
  expect(supabaseClientMock.rpc).toHaveBeenCalledWith(
    'match_documents',
    {
      filter: { a: 2 },
      query_embedding: [1, 2, 3],
      match_count: 5,
    }
  );
});

test('similaritySearchVectorWithScore should call RPC with the passed filters', async () => {
  const supabaseClientMock = {
    rpc: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
  } as Partial<SupabaseClient>;

  const embeddings = new OpenAIEmbeddings();
  const vectorStore = new SupabaseVectorStore(
    embeddings,
    {
      // @ts-ignore
      client: supabaseClientMock,
      tableName: 'documents',
      queryName: 'match_documents',
    },
  );

  await vectorStore.similaritySearchVectorWithScore(
    [1, 2, 3],
    5,
    { b: 3 }
  );
  expect(supabaseClientMock.rpc).toHaveBeenCalledWith(
    'match_documents',
    {
      filter: { b: 3 },
      query_embedding: [1, 2, 3],
      match_count: 5,
    }
  );
});
