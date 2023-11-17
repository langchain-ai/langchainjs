import { OpenAI } from "langchain/llms/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import {
  VectorStoreToolkit,
  createVectorStoreAgent,
  VectorStoreInfo,
} from "langchain/agents";

const model = new OpenAI({ temperature: 0 });
/* Load in the file we want to do question answering over */
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
/* Split the text into chunks using character, not token, size */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
/* Create the vectorstore */
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

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

const result = await agent.invoke({ input });
console.log(`Got output ${result.output}`);
console.log(
  `Got intermediate steps ${JSON.stringify(result.intermediateSteps, null, 2)}`
);
