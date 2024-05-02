import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

/* Initialize the LLM to use to answer the question */
const model = new OpenAI({});
/* Load in the file we want to do question answering over */
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
/* Split the text into chunks */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
/* Create the vectorstore */
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
/* Create the chain */
const chain = ConversationalRetrievalQAChain.fromLLM(
  model,
  vectorStore.asRetriever()
);
/* Ask it a question */
const question = "What did the president say about Justice Breyer?";
/* Can be a string or an array of chat messages */
const res = await chain.invoke({ question, chat_history: "" });
console.log(res);
/* Ask it a follow up question */
const chatHistory = `${question}\n${res.text}`;
const followUpRes = await chain.invoke({
  question: "Was that nice?",
  chat_history: chatHistory,
});
console.log(followUpRes);
