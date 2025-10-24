import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import hanaClient from "hdb";
import {
  HanaDB,
  HanaDBArgs,
} from "@langchain/community/vectorstores/hanavector";

// Connection parameters
const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  user: process.env.HANA_UID,
  password: process.env.HANA_PWD,
  // useCesu8 : false
};
const client = hanaClient.createClient(connectionParams);
// connet to hanaDB
await new Promise<void>((resolve, reject) => {
  client.connect((err: Error) => {
    // Use arrow function here
    if (err) {
      reject(err);
    } else {
      console.log("Connected to SAP HANA successfully.");
      resolve();
    }
  });
});
const embeddings = new OpenAIEmbeddings();

const args: HanaDBArgs = {
  connection: client,
  tableName: "test_fromDocs",
};
const vectorStore = new HanaDB(embeddings, args);
await vectorStore.initialize();
// Use the store as part of a chain, under the premise that "test_fromDocs" exists and contains the chunked docs.
const model = new ChatOpenAI({ model: "gpt-3.5-turbo-1106" });
const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are an expert in state of the union topics. You are provided multiple context items that are related to the prompt you have to answer. Use the following pieces of context to answer the question at the end.\n\n{context}",
  ],
  ["human", "{input}"],
]);

const combineDocsChain = await createStuffDocumentsChain({
  llm: model,
  prompt: questionAnsweringPrompt,
});

const chain = await createRetrievalChain({
  retriever: vectorStore.asRetriever(),
  combineDocsChain,
});

// Ask the first question (and verify how many text chunks have been used).
const response = await chain.invoke({
  input: "What about Mexico and Guatemala?",
});

console.log("Chain response:");
console.log(response.answer);
console.log(
  `Number of used source document chunks: ${response.context.length}`
);
/*
 The United States has set up joint patrols with Mexico and Guatemala to catch more human traffickers.
 Number of used source document chunks: 4
*/
const responseOther = await chain.invoke({
  input: "What about other countries?",
});
console.log("Chain response:");
console.log(responseOther.answer);
/* Ask another question on the same conversational chain. The answer should relate to the previous answer given.
....including members of NATO, the European Union, and other allies such as Canada....
*/
client.disconnect();
