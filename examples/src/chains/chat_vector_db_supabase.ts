import { OpenAI } from "langchain/llms";
import { ChatVectorDBQAChain } from "langchain/chains";
import { PGVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from '@supabase/supabase-js';

export const run = async () => {
  /* Initialize the LLM to use to answer the question */
  const model = new OpenAI({});

  const client = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_PRIVATE_KEY || ''
  );

  // assuming you've already inserted state_of_the_union
  const vectorStore = await PGVectorStore.fromExistingIndex(
    client,
    new OpenAIEmbeddings(),
    "documents",
    "match_documents",
  );
  
  const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore);
  chain.k = 0.8;

  /* Ask it a question */
  const question = "What did the president say about Justice Breyer?";
  const res = await chain.call({ question, chat_history: [] });
  console.log(res);
  /* Ask it a follow up question */
  const chatHistory = question + res.text;
  const followUpRes = await chain.call({
    question: "Was that nice?",
    chat_history: chatHistory,
  });
  console.log(followUpRes);
};
