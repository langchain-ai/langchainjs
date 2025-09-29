import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as fs from "fs";
import { formatDocumentsAsString } from "langchain/util/document";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

/* Initialize the LLM & set streaming to true */
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  streaming: true,
});
/* Load in the file we want to do question answering over */
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
/* Split the text into chunks */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
/* Create the vectorstore */
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
const retriever = vectorStore.asRetriever();

/**
 * Create a prompt template for generating an answer based on context and
 * a question.
 *
 * Chat history will be an empty string if it's the first question.
 *
 * inputVariables: ["chatHistory", "context", "question"]
 */
const questionPrompt = PromptTemplate.fromTemplate(
  `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------
CONTEXT: {context}
----------
CHAT HISTORY: {chatHistory}
----------
QUESTION: {question}
----------
Helpful Answer:`
);

const chain = RunnableSequence.from([
  {
    question: (input: { question: string; chatHistory?: string }) =>
      input.question,
    chatHistory: (input: { question: string; chatHistory?: string }) =>
      input.chatHistory ?? "",
    context: async (input: { question: string; chatHistory?: string }) => {
      const relevantDocs = await retriever.invoke(input.question);
      const serialized = formatDocumentsAsString(relevantDocs);
      return serialized;
    },
  },
  questionPrompt,
  model,
  new StringOutputParser(),
]);

const stream = await chain.stream({
  question: "What did the president say about Justice Breyer?",
});

let streamedResult = "";
for await (const chunk of stream) {
  streamedResult += chunk;
  console.log(streamedResult);
}
/**
 * The
 * The president
 * The president honored
 * The president honored Justice
 * The president honored Justice Stephen
 * The president honored Justice Stephen B
 * The president honored Justice Stephen Brey
 * The president honored Justice Stephen Breyer
 * The president honored Justice Stephen Breyer,
 * The president honored Justice Stephen Breyer, a
 * The president honored Justice Stephen Breyer, a retiring
 * The president honored Justice Stephen Breyer, a retiring Justice
 * The president honored Justice Stephen Breyer, a retiring Justice of
 * The president honored Justice Stephen Breyer, a retiring Justice of the
 * The president honored Justice Stephen Breyer, a retiring Justice of the United
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme Court
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme Court,
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme Court, for
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme Court, for his
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme Court, for his service
 * The president honored Justice Stephen Breyer, a retiring Justice of the United States Supreme Court, for his service.
 */
