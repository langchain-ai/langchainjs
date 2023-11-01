import { createClient } from "@supabase/supabase-js";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { BufferMemory } from "langchain/memory";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { BaseMessage } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableBranch, RunnableSequence } from "langchain/schema/runnable";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { formatDocumentsAsString } from "langchain/util/document";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";

// Define the path to the repo to preform RAG on.
const REPO_PATH = "/tmp/test_repo";

const privateKey = process.env.SUPABASE_PRIVATE_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

const url = process.env.SUPABASE_URL;
if (!url) throw new Error(`Expected env var SUPABASE_URL`);

const client = createClient(url, privateKey);

// Load the file
const loader = new DirectoryLoader(REPO_PATH, {
  ".ts": (path) => new TextLoader(path),
});
const docs = await loader.load();

// Split the documents
const javascriptSplitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
  chunkSize: 2000,
  chunkOverlap: 200,
});
const texts = await javascriptSplitter.splitDocuments(docs);
console.log("Loaded ", texts.length, " documents.");

/**
 * Load texts into store
 *
 * @link https://js.langchain.com/docs/modules/data_connection/vectorstores/integrations/supabase
 * for documentation on setting up a Supabase vector store.
 */
// const vectorStore = await SupabaseVectorStore.fromDocuments(
//   texts,
//   new OpenAIEmbeddings(),
//   {
//     client,
//     tableName: "documents",
//     queryName: "match_documents",
//   }
// );
const vectorStore = await SupabaseVectorStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  {
    client,
    tableName: "documents",
    queryName: "match_documents",
  }
);
console.log("Loaded vector store");
/** Instantiate the store as a retriever. */
const retriever = vectorStore.asRetriever({
  searchType: "mmr", // Use max marginal relevance search
  searchKwargs: { fetchK: 5 },
});

const model = new ChatOpenAI({ modelName: "gpt-4" });
const memory = new BufferMemory({
  returnMessages: true, // Return stored messages as instances of `BaseMessage`
  memoryKey: "chat_history", // This must match up with our prompt template input variable.
});

const question_generator_template = ChatPromptTemplate.fromMessages([
  [
    "ai",
    `Given the following conversation about a codebase and a follow up question, rephrase the follow up question to be a standalone question.`,
  ],
  new MessagesPlaceholder("chat_history"),
  [
    "ai",
    `Follow Up Input: {question}
Standalone question:`,
  ],
]);

const combineDocumentsPrompt = ChatPromptTemplate.fromMessages([
  [
    "ai",
    `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\nQuestion: {question}\n`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["ai", "Helpful answer:"],
]);
const combineDocumentsChain = RunnableSequence.from([
  {
    question: (i: { question: string }) => i.question,
    chat_history: async () => {
      console.log("calling combine docs chain");
      const { chat_history } = await memory.loadMemoryVariables({});
      return chat_history;
    },
    context: async (i: { question: string }) => {
      const relevantDocs = await retriever.getRelevantDocuments(i.question);
      return formatDocumentsAsString(relevantDocs);
    },
  },
  combineDocumentsPrompt,
  model,
  new StringOutputParser(),
]);

const questionGeneratorChain = RunnableSequence.from([
  {
    question: (i: { question: string }) => i.question,
    chat_history: async () => {
      const { chat_history } = await memory.loadMemoryVariables({});
      return chat_history;
    },
  },
  question_generator_template,
  model,
  new StringOutputParser(),
]);

// Calls question generator chain and then passes the result to the combine docs chain.
const questionGeneratorAndCombineDocumentsChain = RunnableSequence.from([
  {
    question: (i: { question: string }) => {
      console.log("calling qa chain");
      return questionGeneratorChain.invoke(i);
    },
  },
  combineDocumentsChain,
]);

// Use RunnableBranch to either map through to the question generator chain
// or to the combine documents chain.
const conversationalQaChain = RunnableBranch.from([
  [
    (i: { chat_history: BaseMessage[]; question: string }) =>
      i.chat_history.length > 1,
    questionGeneratorAndCombineDocumentsChain,
  ],
  [
    (i: { chat_history: BaseMessage[]; question: string }) =>
      i.chat_history.length <= 1,
    combineDocumentsChain,
  ],
  combineDocumentsChain,
]);

const question = "How can I initialize a ReAct agent?";
const result = await conversationalQaChain.invoke({
  question,
  chat_history: (await memory.loadMemoryVariables({})).chat_history,
});
console.log(result);
await memory.saveContext(
  {
    input: question,
  },
  {
    output: result,
  }
);


const question2 =
  "How can I import and use the Wikipedia and File System tools from LangChain instead?";
const result2 = await conversationalQaChain.invoke({
  question: question2,
  chat_history: (await memory.loadMemoryVariables({})).chat_history,
});
console.log(result2);
