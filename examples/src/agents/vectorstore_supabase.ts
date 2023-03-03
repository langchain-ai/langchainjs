import { OpenAI } from "langchain";
import { OpenAIEmbeddings } from "langchain/embeddings";
import {
  VectorStoreToolkit,
  createVectorStoreAgent,
  VectorStoreInfo,
} from "langchain/agents";
import { PGVectorStore } from "langchain/vectorstores";
import { createClient } from '@supabase/supabase-js';


export const run = async () => {
  const model = new OpenAI({ temperature: 0 });

  const client = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_PRIVATE_KEY || ''
  );

  const vectorStore = await PGVectorStore.fromExistingIndex(
    client,
    new OpenAIEmbeddings(),
    'match_documents'
  );

  /* Create the agent */
  const vectorStoreInfo: VectorStoreInfo = {
    name: "state_of_union_address",
    description: "the most recent state of the Union address",
    vectorStore,
  };

  const toolkit = new VectorStoreToolkit(vectorStoreInfo, model);
  const agent = createVectorStoreAgent(model, toolkit);

  const input =
    "What did biden say about Ketanji Brown Jackson is the state of the union address?";
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
