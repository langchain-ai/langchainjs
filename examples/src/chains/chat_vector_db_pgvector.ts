// import { OpenAI } from "langchain/llms";
// import { ChatVectorDBQAChain } from "langchain/chains";
// import { PGVectorStore } from "langchain/vectorstores";
// import { OpenAIEmbeddings } from "langchain/embeddings";
// import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// import * as fs from "fs";
// import pg from "pg";
// import PostgresClient from "./pgvector-pg.ts";

// export const run = async () => {
  
//   // todo this would be much better with a connection string
//   const client = new pg.Pool({
//     user: process.env.PGVECTOR_USER,
//     host: process.env.PGVECTOR_HOST,
//     database: process.env.PGVECTOR_DATABASE,
//     password: process.env.PGVECTOR_PASSWORD,
//     port: parseInt(process.env.PGVECTOR_PORT || '5432', 10)
//   });
//   const pgClient = new PostgresClient(client);

//   /* Initialize the LLM to use to answer the question */
//   const model = new OpenAI({});
//   /* Load in the file we want to do question answering over */
//   const text = fs.readFileSync("state_of_the_union.txt", "utf8");
//   /* Split the text into chunks */
//   const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
//   const docs = await textSplitter.createDocuments([text]);

//   pgClient.prepare(); // danger this will drop and rebuild tables 
//   const vectorStore = await PGVectorStore.fromDocuments(
//     pgClient,
//     docs,
//     new OpenAIEmbeddings(),
//   );

//   const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore);
//   chain.k = 0.5;

//   /* Ask it a question */
//   const question = "What did the president say about Justice Breyer?";
//   const res = await chain.call({ question, chat_history: [] });
//   console.log(res);
//   /* Ask it a follow up question */
//   const chatHistory = question + res.text;
//   const followUpRes = await chain.call({
//     question: "Was that nice?",
//     chat_history: chatHistory,
//   });
//   console.log(followUpRes);
// };
