import { PGVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from '@supabase/supabase-js'

export const run = async () => {
  const client = createClient(
      'https://ejkdqsopvxugwjlzgspn.supabase.co',
      process.env.SUPABASE_PRIVATE_KEY || ''
    );
    
  const vectorStore = await PGVectorStore.fromExistingIndex(
    client,
    new OpenAIEmbeddings(),
    'search_embeddings'
  );

  const resultOne = await vectorStore.similaritySearchWithScore(
    "Hello world",
    2
  );
  console.dir(resultOne, { depth: null });
};

