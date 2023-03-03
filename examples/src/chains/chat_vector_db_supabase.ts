import { OpenAI } from "langchain/llms";
import { ChatVectorDBQAChain } from "langchain/chains";
import { PGVectorStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { createClient } from "@supabase/supabase-js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

export const run = async () => {
  const client = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_PRIVATE_KEY || ""
  );

  /* Initialize the LLM to use to answer the question */
  const model = new OpenAI({});
  /* Load in the file we want to do question answering over */
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  /* Split the text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);

  const vectorStore = await PGVectorStore.fromDocuments(
    client,
    docs,
    new OpenAIEmbeddings(),
    "documents",
    "match_documents"
  );

  const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore);
  chain.k = 0.50;

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
