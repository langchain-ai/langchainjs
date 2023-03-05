// import { OpenAI } from "langchain";
// import { OpenAIEmbeddings } from "langchain/embeddings";
// import {
//   VectorStoreToolkit,
//   createVectorStoreAgent,
//   VectorStoreInfo,
// } from "langchain/agents";
// import { PGVectorStore } from "langchain/vectorstores";
// import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// import * as fs from "fs";
// import { PostgresClient } from "../pgvector-postgres.js";
// import postgres from "postgres";

// export const run = async () => {
//   // todo this would be much better with a connection string
//   const client = postgres({
//     host: process.env.PGVECTOR_HOST,
//     port: parseInt(process.env.PGVECTOR_PORT || "5432", 10),
//     password: process.env.PGVECTOR_PASSWORD,
//     db: process.env.PGVECTOR_DATABASE,
//     username: process.env.PGVECTOR_USER,
//   });
//   const pgClient = new PostgresClient(client);

//   const model = new OpenAI({ temperature: 0 });
//   /* Load in the file we want to do question answering over */
//   const text = fs.readFileSync("state_of_the_union.txt", "utf8");
//   /* Split the text into chunks */
//   const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
//   const docs = await textSplitter.createDocuments([text]);

//   /* Create the vectorstore */
//   pgClient.prepare(); // danger this will drop and rebuild tables
//   const vectorStore = await PGVectorStore.fromDocuments(
//     pgClient,
//     docs,
//     new OpenAIEmbeddings()
//   );

//   /* Or if its already created and filled */
//   // const vectorStore = await PGVectorStore.fromExistingIndex(
//   //   client,
//   //   new OpenAIEmbeddings(),
//   // );

//   /* Create the agent */
//   const vectorStoreInfo: VectorStoreInfo = {
//     name: "state_of_union_address",
//     description: "the most recent state of the Union address",
//     vectorStore,
//   };

//   const toolkit = new VectorStoreToolkit(vectorStoreInfo, model);
//   const agent = createVectorStoreAgent(model, toolkit);

//   const input =
//     "What did biden say about Ketanji Brown Jackson is the state of the union address?";
//   console.log(`Executing: ${input}`);
//   const result = await agent.call({ input });
//   console.log(`Got output ${result.output}`);
//   console.log(
//     `Got intermediate steps ${JSON.stringify(
//       result.intermediateSteps,
//       null,
//       2
//     )}`
//   );
// };
