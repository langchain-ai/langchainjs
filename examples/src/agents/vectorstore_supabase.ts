import { OpenAI } from "langchain";
import { OpenAIEmbeddings } from "langchain/embeddings";
import {
  VectorStoreToolkit,
  createVectorStoreAgent,
  VectorStoreInfo,
} from "langchain/agents";
import { PGVectorStore } from "langchain/vectorstores";
import { createClient } from '@supabase/supabase-js'


export const run = async () => {
  const model = new OpenAI({ temperature: 0 });

  const client = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_PRIVATE_KEY || ''
  );

  const vectorStore = await PGVectorStore.fromExistingIndex(
    client,
    new OpenAIEmbeddings(),
    'search_embeddings'
  );

  /* Create the agent */
  const vectorStoreInfo: VectorStoreInfo = {
    name: "music_business",
    description: "common questions and answers about the music industry",
    vectorStore,
  };

  const toolkit = new VectorStoreToolkit(vectorStoreInfo, model);
  const agent = createVectorStoreAgent(model, toolkit);

  const input =
    "How do I get a record deal?";
  console.log(`Executing: ${input}`);
  const result = await agent.call({ input });
  console.log(`Got output ${result.output}`);
  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
};
